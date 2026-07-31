import { CLOUDINARY_NAME, CLOUDINARY_SIGN } from '../constants/forms';
import store from '../store';
import { SUBMIT_GROUP_ANSWER, TRIGGER_FOLLOWUP_TASKS } from './constants';
import api from './index';
import { networkService, NetworkStatus } from './networkService';
import { offlineStorageService, OfflineSubmission } from './offlineStorageService';
import { uploadToCloudinary } from './uploadToCloudinary';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

class BackgroundSyncService {
  private isRunning = false;
  private syncInProgress = false;
  private networkListenerUnsubscribe?: () => void;

  constructor() {
    // Delay initialization to ensure all services are ready
    setTimeout(() => {
      this.initialize();
    }, 100);
  }

  private initialize() {
    try {
      // Listen for network changes
      this.networkListenerUnsubscribe = networkService.addListener((status) => {
        this.handleNetworkChange(status);
      });

      // Attempt a sync shortly after initialization.
      // This covers the case where the app starts while already online.
      setTimeout(() => {
        this.startSync();
      }, 5000); // 5-second delay to be safe

      // Start periodic cleanup
      this.startPeriodicCleanup();
    } catch (error) {
    }
  }

  private async handleNetworkChange(status: NetworkStatus) {
    if (status.isConnected && status.isInternetReachable !== false) {
      setTimeout(async () => {
        const result = await this.startSync();
      }, 2000);
    } else {
    }
  }

  /**
   * Start background sync process
   */
  async startSync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return { success: false, syncedCount: 0, failedCount: 0, errors: ['Sync already in progress'] };
    }

    if (!networkService.isOnline()) {
      return { success: false, syncedCount: 0, failedCount: 0, errors: ['Device is offline'] };
    }

    this.syncInProgress = true;

    try {
      const pendingSubmissions = await offlineStorageService.getPendingSubmissions();

      if (pendingSubmissions.length === 0) {
        return { success: true, syncedCount: 0, failedCount: 0, errors: [] };
      }

      let syncedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Process submissions in order (oldest first)
      const sortedSubmissions = pendingSubmissions.sort((a, b) => a.timestamp - b.timestamp);

      for (const submission of sortedSubmissions) {
        try {
          await this.syncSubmission(submission);
          syncedCount++;
        } catch (error: any) {
          failedCount++;
          const errorMsg = `Failed to sync ${submission.id}: ${error.message || 'Unknown error'}`;
          errors.push(errorMsg);

          // Update submission status
          await offlineStorageService.updateSubmissionStatus(
            submission.id,
            'failed',
            error.message
          );
        }

        // Small delay between submissions to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const result: SyncResult = {
        success: failedCount === 0,
        syncedCount,
        failedCount,
        errors,
      };

      return result;

    } catch (error: any) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errors: [error.message || 'Unknown sync error'],
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync a single submission
   */
  private async syncSubmission(submission: OfflineSubmission): Promise<void> {
    // Mark as syncing
    await offlineStorageService.updateSubmissionStatus(submission.id, 'syncing');

    try {
      // Get user info from Redux store
      const user = store.getState().user;
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Before building the payload, ensure any offline media files are uploaded
      const answersWithMedia = submission.data?.answers || [];
      await this.processOfflineMedia(answersWithMedia);

      let payload: any;
      let apiEndpoint: string;

      if (submission.submissionType === 'audit') {
        // Handle AUDIT form submission
        apiEndpoint = SUBMIT_GROUP_ANSWER;
        payload = {
            form: submission.formId,
            group_assignment_uuid: submission.groupAssignmentUuid,
            answers: answersWithMedia,
            // Prevent backend auto-sharing when the web "share response" toggle is enabled.
            // Sharing should only happen when the user explicitly taps the Share button.
            share_response: false,
            allow_share: false,
        };

        // Include form_submission_id for audit form edits (updates existing submission instead of creating new)
        if (submission.formSubmissionId) {
            payload.form_submission_id = submission.formSubmissionId;
        }

    } else {
        // Handle STAGE-based form submission (default)
        apiEndpoint = "/form/stage/submit-answer/";
        payload = {
            form: submission.formId,
            stage: submission.stageId,
            stage_assignment_uuid: submission.stageAssignmentUuid,
            answers: answersWithMedia,
            // Prevent backend auto-sharing when the web "share response" toggle is enabled.
            // Sharing should only happen when the user explicitly taps the Share button.
            share_response: false,
            allow_share: false,
        };

        // Include form_submission_id for non-first stages
        if (submission.formSubmissionId) {
            payload.form_submission_id = submission.formSubmissionId;
        }
    }
      const response = await api.post(apiEndpoint, payload);

      // Trigger follow-up tasks after successful sync (same as online flow)
      const formSubmissionId = response?.data?.form_submission_id;
      if (formSubmissionId) {
        try {
          await api.post(TRIGGER_FOLLOWUP_TASKS, {
            form_id: submission.formId,
            main_form_submission_id: formSubmissionId,
            followup_task_form_id: submission.formId,
          });
        } catch (triggerError) {
          // Don't fail the sync if follow-up trigger fails - submission itself succeeded
        }
      }

      // Mark as completed and remove from storage
      await offlineStorageService.updateSubmissionStatus(submission.id, 'completed');
      await offlineStorageService.removeSubmission(submission.id);
    } catch (error: any) {

      // Check if we can retry
      if (offlineStorageService.canRetry(submission)) {
        await offlineStorageService.updateSubmissionStatus(submission.id, 'failed', error.message);
      } else {
        await offlineStorageService.updateSubmissionStatus(
          submission.id,
          'failed',
          `Max retries exceeded: ${error.message}`
        );
      }

      throw error;
    }
  }

  /**
   * For offline submissions that contain media (image/video/audio/file/signature),
   * upload any local URIs to Cloudinary and replace the answer values
   * with the resulting secure URLs before syncing to the backend.
   */
  private async processOfflineMedia(answers: any[]): Promise<void> {
    if (!answers || answers.length === 0) return;

    const MEDIA_TYPES = ["upload_image", "upload_video", "upload_audio", "upload_file", "signature"];

    for (const answer of answers) {
      try {
        if (!MEDIA_TYPES.includes(answer.question_type) || !answer.answer) continue;

        const urls = String(answer.answer).split("|").filter(Boolean);
        const processedUrls: string[] = [];

        for (const url of urls) {
          // If already a remote URL, keep as is
          if (url.startsWith("http://") || url.startsWith("https://")) {
            processedUrls.push(url);
            continue;
          }

          // Treat non-HTTP URLs (e.g., file:// or data: URIs) as local files that must be uploaded
          try {
            const mimeType =
              answer.question_type === "upload_video"
                ? "video/mp4"
                : answer.question_type === "upload_audio"
                ? "audio/mpeg"
                : "image/png"; // images & signatures

            const extension = mimeType.split("/")[1] || "jpg";
            const file = {
              uri: url,
              name: `offline_file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${extension}`,
              type: mimeType,
            };

            const cloudinaryUrl = await uploadToCloudinary(file, CLOUDINARY_SIGN, CLOUDINARY_NAME);
            processedUrls.push(cloudinaryUrl);
          } catch (uploadError: any) {
            // If upload fails, keep the original URL so we don't lose data
            processedUrls.push(url);
          }
        }

        answer.answer = processedUrls.join("|");
      } catch (err) {
      }
    }
  }

  /**
   * Force immediate sync
   */
  async forceSync(): Promise<SyncResult> {
    return this.startSync();
  }

  /**
   * Check if sync is currently running
   */
  isSyncRunning(): boolean {
    return this.syncInProgress;
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      syncInProgress: this.syncInProgress,
      isOnline: networkService.isOnline(),
    };
  }

  /**
   * Start periodic cleanup of old completed submissions
   */
  private startPeriodicCleanup() {
    // Clean up old submissions every 24 hours
    setInterval(async () => {
      try {
        await offlineStorageService.cleanupCompleted(7); // Keep completed submissions for 7 days
      } catch (error) {
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Stop the background sync service
   */
  stop() {
    if (this.networkListenerUnsubscribe) {
      this.networkListenerUnsubscribe();
    }
    this.isRunning = false;
  }

  /**
   * Retry failed submissions
   */
  async retryFailedSubmissions(): Promise<SyncResult> {

    const submissions = await offlineStorageService.getAllSubmissions();
    const failedSubmissions = submissions.filter(sub => sub.status === 'failed');

    if (failedSubmissions.length === 0) {
      return { success: true, syncedCount: 0, failedCount: 0, errors: [] };
    }

    // Reset failed submissions to pending for retry
    for (const submission of failedSubmissions) {
      if (offlineStorageService.canRetry(submission)) {
        await offlineStorageService.updateSubmissionStatus(submission.id, 'pending');
      }
    }

    // Start sync
    return this.startSync();
  }

  /**
   * Get pending submissions count
   */
  async getPendingCount(): Promise<number> {
    const stats = await offlineStorageService.getStats();
    return stats.pendingSubmissions + stats.failedSubmissions;
  }
}

// Create singleton instance
export const backgroundSyncService = new BackgroundSyncService();

export default backgroundSyncService;
