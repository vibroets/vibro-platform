// offlineStorageService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Directory, Paths } from 'expo-file-system';
import { networkService } from './networkService';

/**
 * Offline storage using Expo SDK 54+ File & Directory classes.
 * Stores files under Paths.document + 'offline/' (persistent Documents).
 *
 * Note:
 * - Requires expo-file-system from SDK 54+ and a dev build / proper runtime.
 * - The new File API offers .write/.text/.delete etc.
 */

export interface OfflineSubmission {
  id: string;
  formId: number;
  stageId?: number;
  formSubmissionId?: number;
  data: any;
  timestamp: number;
  retryCount: number;
  lastRetryAt?: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  error?: string;
  stageAssignmentUuid?: string;
  groupAssignmentUuid?: string;
  submissionType: 'stage' | 'audit';
  userId: number;
  organizationId: number;
}

export interface OfflineStorageStats {
  totalSubmissions: number;
  pendingSubmissions: number;
  failedSubmissions: number;
  completedSubmissions: number;
}

export interface DraftData {
  id: string;
  formId: number;
  formTitle?: string;
  currentStageIndex: number;
  completedStages: number[];
  formData: any;
  formStructure?: any;
  timestamp: number;
  userId: number;
  organizationId: number;
  sourceScreen?: string;
  taskId?: number;
  formType?: string;
}

class OfflineStorageService {
  private readonly STORAGE_KEY = '@offline_submissions';
  private readonly STATS_KEY = '@offline_stats';
  private readonly DRAFTS_KEY = '@form_drafts';
  private readonly MAX_RETRY_COUNT = 3;
  private readonly RETRY_DELAY_MS = 5000; // ms

  private migrated = false;
  private readonly SUBMISSIONS_FILENAME = 'offline_submissions.json';
  private readonly STATS_FILENAME = 'offline_stats.json';
  private readonly DRAFTS_FILENAME = 'form_drafts.json';
  private readonly OFFLINE_DIR_NAME = 'offline';

  // ---------- Helpers for Files & Directory ----------

  /** Ensure offline directory exists and return Directory instance */
  private async ensureOfflineDirectory(): Promise<Directory> {
    // Paths.document is the persistent Documents directory
    const dir = new Directory(Paths.document, this.OFFLINE_DIR_NAME);
    try {
      // Directory.create throws if cannot create; if it exists it may throw - so ignore errors
      await dir.create();
    } catch (err) {
      // create() may throw if it already exists; ignore
    }
    return dir;
  }

  /** Return a File instance for a filename inside the offline directory (does not guarantee existence) */
  private async fileFor(filename: string): Promise<File> {
    const dir = await this.ensureOfflineDirectory();
    // Create a File using base path Paths.document and a combined path 'offline/filename'
    // File constructor accepts (basePath, name)
    return new File(Paths.document, `${this.OFFLINE_DIR_NAME}/${filename}`);
  }

  /** Read file text; returns null if not present or error */
  private async readFileText(filename: string): Promise<string | null> {
    try {
      const file = await this.fileFor(filename);
      // file.text() reads the file asynchronously
      const txt = await file.text();
      // if empty string treated as empty content
      return typeof txt === 'string' && txt.length > 0 ? txt : (txt === '' ? '' : null);
    } catch (error) {
      // File.text() may throw if file doesn't exist; treat as null
      return null;
    }
  }

  /** Write file atomically: write to a temp file, copy contents to final file, remove temp */
  private async writeFileAtomically(filename: string, data: string): Promise<void> {
    const tempName = `${filename}.tmp`;
    const tempFile = await this.fileFor(tempName);
    const finalFile = await this.fileFor(filename);

    try {
      // Write temp contents
      await tempFile.write(data);

      // Read temp and write into final (avoids exposing partially written content)
      const tempText = await tempFile.text();
      await finalFile.write(tempText);

      // Remove temp
      try {
        await tempFile.delete();
      } catch (e) {
        // ignore delete errors
      }
    } catch (error) {
      // Try best-effort cleanup
      try {
        await tempFile.delete();
      } catch {}
      throw error;
    }
  }

  /** Delete a file (ignore if missing) */
  private async deleteFileIfExists(filename: string): Promise<void> {
    try {
      const file = await this.fileFor(filename);
      await file.delete();
    } catch {
      // ignore
    }
  }

  // ---------- Migration from AsyncStorage ----------

  private async migrateIfNeeded(): Promise<void> {
    if (this.migrated) return;
    this.migrated = true;

    try {
      const submissions = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (submissions) {
        await this.writeFileAtomically(this.SUBMISSIONS_FILENAME, submissions);
        await AsyncStorage.removeItem(this.STORAGE_KEY);
      }

      const stats = await AsyncStorage.getItem(this.STATS_KEY);
      if (stats) {
        await this.writeFileAtomically(this.STATS_FILENAME, stats);
        await AsyncStorage.removeItem(this.STATS_KEY);
      }

      const drafts = await AsyncStorage.getItem(this.DRAFTS_KEY);
      if (drafts) {
        await this.writeFileAtomically(this.DRAFTS_FILENAME, drafts);
        await AsyncStorage.removeItem(this.DRAFTS_KEY);
      }
    } catch (error) {
    }
  }

  // ---------- Submissions API (preserve original surface) ----------

  async storeSubmission(submission: Omit<OfflineSubmission, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    try {
      const submissions = await this.getAllSubmissions();
      const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const offlineSubmission: OfflineSubmission = {
        ...submission,
        id,
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending',
      };

      submissions.push(offlineSubmission);
      await this.writeFileAtomically(this.SUBMISSIONS_FILENAME, JSON.stringify(submissions));
      await this.updateStats();
      return id;
    } catch (error) {
      throw error;
    }
  }

  async getAllSubmissions(): Promise<OfflineSubmission[]> {
    try {
      await this.migrateIfNeeded();
      const data = await this.readFileText(this.SUBMISSIONS_FILENAME);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      return [];
    }
  }

  async getPendingSubmissions(): Promise<OfflineSubmission[]> {
    const submissions = await this.getAllSubmissions();
    return submissions.filter(sub => sub.status === 'pending' || sub.status === 'failed');
  }

  async updateSubmissionStatus(id: string, status: OfflineSubmission['status'], error?: string): Promise<void> {
    try {
      const submissions = await this.getAllSubmissions();
      const index = submissions.findIndex(sub => sub.id === id);
      if (index !== -1) {
        submissions[index].status = status;
        if (error) submissions[index].error = error;
        if (status === 'failed') {
          submissions[index].retryCount = (submissions[index].retryCount || 0) + 1;
          submissions[index].lastRetryAt = Date.now();
        }
        await this.writeFileAtomically(this.SUBMISSIONS_FILENAME, JSON.stringify(submissions));
        await this.updateStats();
      }
    } catch (err) {
    }
  }

  async removeSubmission(id: string): Promise<void> {
    try {
      const submissions = await this.getAllSubmissions();
      const filtered = submissions.filter(sub => sub.id !== id);
      await this.writeFileAtomically(this.SUBMISSIONS_FILENAME, JSON.stringify(filtered));
      await this.updateStats();
    } catch (err) {
    }
  }

  // ---------- Stats ----------

  async getStats(): Promise<OfflineStorageStats> {
    try {
      await this.migrateIfNeeded();
      const data = await this.readFileText(this.STATS_FILENAME);
      if (data) return JSON.parse(data);
    } catch (err) {
    }
    return this.updateStats();
  }

  private async updateStats(): Promise<OfflineStorageStats> {
    try {
      const submissions = await this.getAllSubmissions();
      const stats: OfflineStorageStats = {
        totalSubmissions: submissions.length,
        pendingSubmissions: submissions.filter(s => s.status === 'pending').length,
        failedSubmissions: submissions.filter(s => s.status === 'failed').length,
        completedSubmissions: submissions.filter(s => s.status === 'completed').length,
      };
      await this.writeFileAtomically(this.STATS_FILENAME, JSON.stringify(stats));
      return stats;
    } catch (err) {
      return { totalSubmissions: 0, pendingSubmissions: 0, failedSubmissions: 0, completedSubmissions: 0 };
    }
  }

  // ---------- Retry helpers ----------

  canRetry(submission: OfflineSubmission): boolean {
    return submission.retryCount < this.MAX_RETRY_COUNT &&
      (submission.status === 'pending' || submission.status === 'failed');
  }

  getRetryDelay(submission: OfflineSubmission): number {
    return this.RETRY_DELAY_MS * Math.pow(2, submission.retryCount);
  }

  // ---------- Cleanup / Utility ----------

  async clearAll(): Promise<void> {
    try {
      await this.deleteFileIfExists(this.SUBMISSIONS_FILENAME);
      await this.deleteFileIfExists(this.STATS_FILENAME);
      await this.deleteFileIfExists(this.DRAFTS_FILENAME);
    } catch (err) {
    }
  }

  async cleanupCompleted(daysOld: number = 7): Promise<void> {
    try {
      const submissions = await this.getAllSubmissions();
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      const filtered = submissions.filter(sub => sub.status !== 'completed' || sub.timestamp > cutoffTime);
      if (filtered.length !== submissions.length) {
        await this.writeFileAtomically(this.SUBMISSIONS_FILENAME, JSON.stringify(filtered));
        await this.updateStats();
      }
    } catch (err) {
    }
  }

  async getSubmissionsForForm(formId: number): Promise<OfflineSubmission[]> {
    const submissions = await this.getAllSubmissions();
    return submissions.filter(sub => sub.formId === formId);
  }

  async hasPendingSubmissionsForForm(formId: number): Promise<boolean> {
    const submissions = await this.getSubmissionsForForm(formId);
    return submissions.some(sub => sub.status === 'pending' || sub.status === 'failed');
  }

  // ===== DRAFT MANAGEMENT =====

  async storeDraft(draft: Omit<DraftData, 'id' | 'timestamp'> & { id?: string }): Promise<string> {
    try {
      const drafts = await this.getAllDrafts();

      // Allow caller to provide an explicit id (for server-created drafts). Otherwise generate a local id.
      const id = draft.id || `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const draftData: DraftData = { ...draft, id, timestamp: Date.now() } as DraftData;

      // Do NOT remove other drafts for the same form/user — keep all drafts distinct so multiple
      // drafts for the same form can be saved and shown in the Drafts list.
      drafts.push(draftData);

      await this.writeFileAtomically(this.DRAFTS_FILENAME, JSON.stringify(drafts));
      return id;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Store a database draft locally for offline access
   * This is called after a draft is successfully saved to the database
   * @param draftData The draft data from the database
   */
  async storeDatabaseDraftLocally(draftData: DraftData): Promise<void> {
    try {
      const drafts = await this.getAllDrafts();

      // Check if this draft already exists locally
      const existingIndex = drafts.findIndex(d => d.id === draftData.id);
      if (existingIndex !== -1) {
        // Update existing draft
        drafts[existingIndex] = { ...draftData };
      } else {
        // Add new draft
        drafts.push(draftData);
      }

      await this.writeFileAtomically(this.DRAFTS_FILENAME, JSON.stringify(drafts));
    } catch (err) {
    }
  }

  async getAllDrafts(): Promise<DraftData[]> {
    try {
      await this.migrateIfNeeded();
      const data = await this.readFileText(this.DRAFTS_FILENAME);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      return [];
    }
  }

  async getDraftForForm(formId: number, userId: number): Promise<DraftData | null> {
    const drafts = await this.getAllDrafts();
    return drafts.find(d => d.formId === formId && d.userId === userId) || null;
  }

  async removeDraft(id: string): Promise<void> {
    try {
      // Check if it's a database draft (starts with "db_draft_")
      if (id.startsWith('db_draft_')) {
        // Extract draft_id from the database draft ID
        const parts = id.split('_');
        if (parts.length >= 3) {
          const draftId = parseInt(parts[2]);
          if (!isNaN(draftId)) {
            try {
              // Try to delete from database
              await this.deleteDatabaseDraft(draftId);
            } catch (deleteError: any) {
              // If delete fails (404 or other error), log but continue to remove local copy
            }
          }
        }
      }

      // Always remove from local storage after attempting database delete
      const drafts = await this.getAllDrafts();
      const filtered = drafts.filter(d => d.id !== id);
      await this.writeFileAtomically(this.DRAFTS_FILENAME, JSON.stringify(filtered));
    } catch (err) {
    }
  }

  /**
   * Delete a draft from the database
   * @param draftId The draft ID to delete
   */
  async deleteDatabaseDraft(draftId: number): Promise<void> {
    try {
      // Import api here to avoid circular dependencies
      const api = (await import('./index')).default;
      await api.delete(`/drafts/${draftId.toString()}/delete/`);
    } catch (error: any) {
      throw error;
    }
  }

  async clearAllDraftsForUser(userId: number): Promise<void> {
    try {
      const drafts = await this.getAllDrafts();
      const filtered = drafts.filter(d => d.userId !== userId);
      await this.writeFileAtomically(this.DRAFTS_FILENAME, JSON.stringify(filtered));
    } catch (err) {
    }
  }

  async getDraftsCountForUser(userId: number): Promise<number> {
    const drafts = await this.getAllDrafts();
    return drafts.filter(d => d.userId === userId).length;
  }

  async cleanupOldDrafts(daysOld: number = 30): Promise<void> {
    try {
      const drafts = await this.getAllDrafts();
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      const filtered = drafts.filter(d => d.timestamp > cutoffTime);
      if (filtered.length !== drafts.length) {
        await this.writeFileAtomically(this.DRAFTS_FILENAME, JSON.stringify(filtered));
      }
    } catch (err) {
    }
  }

  // Placeholder for future migrations
  async migrateOldPaths(): Promise<void> {
  }

  // ===== DATABASE DRAFT LOADING =====

  /**
   * Load draft data from backend for a specific draft ID (online only)
   * Since backend returns all drafts for a form, we need to extract the specific one
   * @param draftId The draft ID to load data for (format: db_draft_{numeric_id})
   * @returns Draft data from backend or null if not found
   */
  async loadDraftFromBackend(draftId: string): Promise<DraftData | null> {
    try {
      // Import api here to avoid circular dependencies
      const api = (await import('./index')).default;

      // Extract the numeric draft_id from the mobile app format (db_draft_{id})
      let numericDraftId = draftId;
      if (draftId.startsWith('db_draft_')) {
        numericDraftId = draftId.replace('db_draft_', '');
      }

      // Since we don't know the form_id from the draftId, we need to get all drafts
      // and find the one that matches our draft_id
      const listResponse = await api.get(`/drafts/`);
      if (listResponse && listResponse.data && Array.isArray(listResponse.data)) {
        // Find the draft in the list to get its form_id
        const draftInList = listResponse.data.find((d: any) =>
          d.draft_id && d.draft_id.toString() === numericDraftId.toString()
        );

        if (draftInList && draftInList.form_id) {
          // Now get all drafts for this form
          const payloadResponse = await api.get(`/drafts/get-payload/${draftInList.form_id}/`);

          if (payloadResponse && payloadResponse.data && payloadResponse.data.drafts && Array.isArray(payloadResponse.data.drafts)) {
            // Find the specific draft we want
            const targetDraft = payloadResponse.data.drafts.find((d: any) =>
              d.draft_id && d.draft_id.toString() === numericDraftId.toString()
            );

            if (targetDraft && targetDraft.form_data) {
              const formData = targetDraft.form_data;
              const draftData: DraftData = {
                id: draftId, // Keep the mobile app format (db_draft_{id})
                formId: formData.formId || draftInList.form_id,
                formTitle: formData.formTitle || "Untitled Form",
                currentStageIndex: formData.currentStageIndex || 0,
                completedStages: formData.completedStages || [],
                formData: formData.formData || {},
                formStructure: formData.formStructure,
                timestamp: Date.now(),
                userId: formData.userId || 0,
                organizationId: formData.organizationId || 0,
                sourceScreen: formData.sourceScreen,
                taskId: formData.taskId,
                formType: formData.formType,
              };
              return draftData;
            }
          }
        }
      }

      return null;
    } catch (error: any) {
      // If draft not found (404), return null - this is expected
      if (error.status === 404 || error.response?.status === 404) {
        return null;
      }
      return null;
    }
  }

  /**
   * Get draft for form, checking database first, then local storage
   * @param formId The form ID
   * @param userId The user ID
   * @param preferDatabase Whether to prefer database over local storage (default: true)
   * @returns Draft data or null if not found
   */
  async getDraftForFormWithDatabase(formId: number, userId: number, preferDatabase: boolean = true): Promise<DraftData | null> {
    try {
      let databaseDraft: DraftData | null = null;
      let localDraft: DraftData | null = null;

      // Try to load from backend first (if network available)
      if (preferDatabase && networkService.isOnline()) {
        databaseDraft = await this.loadDraftFromBackend(formId.toString());
      }

      // Always check local storage as fallback
      localDraft = await this.getDraftForForm(formId, userId);

      // Return database draft if available and preferred, otherwise local draft
      if (databaseDraft && preferDatabase) {
        return databaseDraft;
      } else if (localDraft) {
        return localDraft;
      }

      return null;
    } catch (error) {
      // Fall back to local storage
      return this.getDraftForForm(formId, userId);
    }
  }

  // ===== DATABASE DRAFT LISTING =====

  /**
   * Load all drafts from database for the current user
   * @returns Array of database draft data
   */
  async loadAllDraftsFromDatabase(): Promise<DraftData[]> {
    try {
      // Import api here to avoid circular dependencies
      const api = (await import('./index')).default;
      const response = await api.get(`/drafts/`);

      if (response && response.data && Array.isArray(response.data)) {
        // For each draft, we need to get the actual form data from the get-payload endpoint
        // since the list endpoint only returns metadata, not the actual saved form data
        const databaseDrafts: DraftData[] = [];

        for (const dbDraft of response.data) {
          try {
            // Get all drafts for this form from S3 (backend now returns multiple drafts per form)
            const payloadResponse = await api.get(`/drafts/get-payload/${dbDraft.form_id}/`);

            if (payloadResponse && payloadResponse.data) {
              // Handle new backend format that returns multiple drafts
              if (payloadResponse.data.drafts && Array.isArray(payloadResponse.data.drafts)) {
                // Backend returns multiple drafts for this form
                for (const draftInfo of payloadResponse.data.drafts) {
                  const formData = draftInfo.form_data || {};
                  const draftData: DraftData = {
                    id: `db_draft_${draftInfo.draft_id}`,
                    formId: dbDraft.form_id,
                    formTitle: formData.formTitle || "Untitled Form",
                    currentStageIndex: formData.currentStageIndex || 0,
                    completedStages: formData.completedStages || [],
                    formData: formData.formData || {}, // Actual form field values from S3
                    formStructure: formData.formStructure,
                    timestamp: new Date(draftInfo.timestamp || draftInfo.created_at || dbDraft.timestamp).getTime(),
                    userId: dbDraft.user,
                    organizationId: formData.organizationId || 0,
                    sourceScreen: formData.sourceScreen,
                    taskId: formData.taskId,
                    formType: formData.formType,
                  };
                  databaseDrafts.push(draftData);
                }
              } else if (payloadResponse.data.form_data) {
                // Fallback: Handle old single-draft format
                const formData = payloadResponse.data.form_data;
                const draftData: DraftData = {
                  id: `db_draft_${dbDraft.form_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  formId: dbDraft.form_id,
                  formTitle: formData.formTitle || "Untitled Form",
                  currentStageIndex: formData.currentStageIndex || 0,
                  completedStages: formData.completedStages || [],
                  formData: formData.formData || {},
                  formStructure: formData.formStructure,
                  timestamp: new Date(dbDraft.timestamp).getTime(),
                  userId: dbDraft.user,
                  organizationId: formData.organizationId || 0,
                  sourceScreen: formData.sourceScreen,
                  taskId: formData.taskId,
                  formType: formData.formType,
                };
                databaseDrafts.push(draftData);
              }
            }
          } catch (payloadError) {
            // Fallback: Include basic draft info from list endpoint
            const draftData: DraftData = {
              id: `db_draft_${dbDraft.form_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              formId: dbDraft.form_id,
              formTitle: dbDraft.metadata?.formTitle || "Untitled Form",
              currentStageIndex: dbDraft.metadata?.currentStageIndex || 0,
              completedStages: dbDraft.metadata?.completedStages || [],
              formData: dbDraft.metadata?.formData || {},
              formStructure: dbDraft.metadata?.formStructure,
              timestamp: new Date(dbDraft.timestamp).getTime(),
              userId: dbDraft.user,
              organizationId: dbDraft.metadata?.organizationId || 0,
              sourceScreen: dbDraft.metadata?.sourceScreen,
              taskId: dbDraft.metadata?.taskId,
              formType: dbDraft.metadata?.formType,
            };
            databaseDrafts.push(draftData);
          }
        }
        return databaseDrafts;
      }

      return [];
    } catch (error: any) {
      // Handle authentication errors gracefully - fall back to local storage
      if (error.status === 401 || error.status === 403 ||
          error.data?.code === 'user_not_found' ||
          error.data?.code === 'token_not_valid') {
        return [];
      }
      return [];
    }
  }

  /**
   * Get all drafts from both database and local storage
   * @param userId The user ID to filter drafts
   * @param preferDatabase Whether to prefer database drafts over local ones (default: true)
   * @returns Combined array of all drafts
   */
  async getAllDraftsWithDatabase(userId: number, preferDatabase: boolean = true): Promise<DraftData[]> {
    try {
      let databaseDrafts: DraftData[] = [];
      let localDrafts: DraftData[] = [];

      // Load database drafts if network is available
      if (networkService.isOnline()) {
        databaseDrafts = await this.loadAllDraftsFromDatabase();
        // Filter by user ID
        databaseDrafts = databaseDrafts.filter(draft => draft.userId === userId);
      }

      // Always load local drafts
      const allLocalDrafts = await this.getAllDrafts();
      localDrafts = allLocalDrafts.filter(draft => draft.userId === userId);

      if (preferDatabase) {
        // Combine database and local drafts, preferring database versions and ensuring unique IDs
        const combinedDraftsMap = new Map<string, DraftData>();

        // First add all database drafts (they take precedence)
        databaseDrafts.forEach(draft => {
          combinedDraftsMap.set(draft.id, draft);
        });

        // Then add local drafts that don't conflict with database drafts
        localDrafts.forEach(localDraft => {
          if (!combinedDraftsMap.has(localDraft.id)) {
            combinedDraftsMap.set(localDraft.id, localDraft);
          }
        });

        const combinedDrafts = Array.from(combinedDraftsMap.values());
        return combinedDrafts.sort((a, b) => b.timestamp - a.timestamp); // Most recent first
      } else {
        // Return local drafts only (fallback mode)
        return localDrafts.sort((a, b) => b.timestamp - a.timestamp);
      }
    } catch (error) {
      // Fall back to local storage
      return this.getAllDrafts().then(drafts =>
        drafts.filter(draft => draft.userId === userId).sort((a, b) => b.timestamp - a.timestamp)
      );
    }
  }
}

export const offlineStorageService = new OfflineStorageService();
export default offlineStorageService;
