import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Api from '../services/index';
import { Alert } from 'react-native';

export const downloadAnnouncementAttachment = async (
  announcementId: number,
  filename: string,
  onProgress?: (progress: FileSystem.DownloadProgressData) => void
): Promise<void> => {
  try {
    // Get authentication token for headers
    const { SecureStoreService, SecureStoreKeys } = await import('../services/secureStore');
    const authInfo = await SecureStoreService.get(SecureStoreKeys.AUTH_INFO);

    // Create the download URL (the API endpoint)
    const downloadUrl = `${Api.defaults.baseURL}/announcements/${announcementId}/download_attachment/?filename=${encodeURIComponent(filename)}`;

    // Prepare headers for authentication
    const headers: Record<string, string> = {};
    if (authInfo && (authInfo as any).isAuthenticated) {
      headers.Authorization = `Bearer ${(authInfo as any).access}`;
    }

    // Define a temporary path for the file
    const tempUri = ((FileSystem as any).cacheDirectory ?? '') + `dl_${Date.now()}_${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;

    // Create a download resumable object and set the progress callback
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      tempUri,
      { headers },
      onProgress
    );

    // Start the download
    const result = await downloadResumable.downloadAsync();

    if (!result || result.status < 200 || result.status >= 300) {
      // Try to read the error response from the file if download failed
      let errorBody = 'Unknown error';
      if (result?.uri) {
        try {
          const errorJson = await FileSystem.readAsStringAsync(result.uri);
          const errorData = JSON.parse(errorJson);
          errorBody = errorData.message || errorJson;
        } catch {
          // Ignore if reading file fails
        }
      }
      throw new Error(`Download failed with status: ${result?.status}. ${errorBody}`);
    }

    // After successful download, share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, {
        mimeType: getMimeType(filename),
        dialogTitle: 'Save or Share File',
      });
    } else {
      Alert.alert(
        'Download Complete',
        `File saved to app's cache. You may need a file manager to access it at: ${result.uri}`
      );
    }

  } catch (error: any) {
    console.error('Download failed:', error);
    Alert.alert('Error', `Failed to download file: ${error.message}`);
    // We throw again so the calling component knows about the failure
    throw error;
  }
};

// Helper function to get MIME type based on file extension
const getMimeType = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
    case 'docx':
      return 'application/msword';
    case 'xls':
    case 'xlsx':
      return 'application/vnd.ms-excel';
    case 'ppt':
    case 'pptx':
      return 'application/vnd.ms-powerpoint';
    case 'txt':
      return 'text/plain';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'avi':
        return 'video/x-msvideo';
    case 'mkv':
        return 'video/x-matroska';
    case 'zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
};
