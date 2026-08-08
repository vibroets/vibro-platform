import React, { useEffect, useState } from 'react';
import {
  View,
  Modal,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FileViewerProps {
  visible: boolean;
  onClose: () => void;
  announcementId: number;
  filename: string;
  allowDownload?: boolean; // false when Prevent Download is ON
}

// PDF.js viewer HTML structure
const pdfReaderHtml = (base64: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js"></script>
  <style>
    body { margin: 0; background-color: #f0f0f0; }
    #pdf-canvas { width: 100%; height: 100%; }
    #loading-container {
      display: flex; justify-content: center; align-items: center;
      height: 100vh; font-family: sans-serif; font-size: 16px; color: #555;
    }
  </style>
</head>
<body>
  <div id="loading-container">Loading PDF...</div>
  <canvas id="pdf-canvas"></canvas>
  <script>
    const pdfData = atob('${base64}');
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    
    loadingTask.promise.then(pdf => {
      document.getElementById('loading-container').style.display = 'none';
      pdf.getPage(1).then(page => {
        const canvas = document.getElementById('pdf-canvas');
        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: window.innerWidth / page.getViewport({ scale: 1 }).width });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        page.render({ canvasContext: context, viewport: viewport });
      });
    });
  </script>
</body>
</html>
`;

export const FileViewer: React.FC<FileViewerProps> = ({
  visible,
  onClose,
  announcementId,
  filename,
  allowDownload = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileDataText, setFileDataText] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('unsupported');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible && announcementId && filename) {
      loadFile();
    } else if (!visible) {
      cleanup();
    }
  }, [visible, announcementId, filename]);

  const loadFile = async () => {
    try {
      setLoading(true);
      setError(null);
      setFileUri(null);
      setFileDataText(null);
      setFileBase64(null);

      const extension = filename.split('.').pop()?.toLowerCase();

      if (['jpg', 'jpeg', 'png', 'gif'].includes(extension ?? '')) {
        setFileType('image');
        await loadImageFile();
      } else if (['mp4', 'mov', 'avi', 'mkv'].includes(extension ?? '')) {
        setFileType('video');
        await loadVideoFile();
      } else if (extension === 'txt') {
        setFileType('text');
        await loadTextFile();
      } else if (extension === 'pdf') {
        setFileType('pdf');
        await loadPdfFile();
      } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension ?? '')) {
        setFileType('office');
        await loadOfficeFile();
      } else {
        setFileType('unsupported');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('File load error:', err);
      setError(`Failed to load file: ${err.message ?? 'Unknown error'}`);
      setLoading(false);
    }
  };

  const buildDownloadRequest = async (
    announcementId: number,
    filename: string
  ): Promise<{ downloadUrl: string; headers: Record<string, string> }> => {
    const Api = (await import('../services/index')).default;
    const { SecureStoreService, SecureStoreKeys } = await import('../services/secureStore');
    const authInfo = await SecureStoreService.get(SecureStoreKeys.AUTH_INFO);

    const downloadUrl =
      `${Api.defaults.baseURL}/announcements/${announcementId}/download_attachment/?filename=` +
      encodeURIComponent(filename);

    const headers: Record<string, string> = {};
    if (authInfo && (authInfo as any).isAuthenticated) {
      headers.Authorization = `Bearer ${(authInfo as any).access}`;
    }

    return { downloadUrl, headers };
  };

  const downloadFileToCache = async (
    announcementId: number,
    filename: string
  ): Promise<string> => {
    const { downloadUrl, headers } = await buildDownloadRequest(announcementId, filename);
    const tempUri = ((FileSystem as any).cacheDirectory ?? '') + `att_${Date.now()}_${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;

    const result = await FileSystem.downloadAsync(downloadUrl, tempUri, {
      headers,
    } as any);

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Download failed with status: ${result.status}`);
    }

    return result.uri;
  };

  const loadImageFile = async () => {
    const uri = await downloadFileToCache(announcementId, filename);
    setFileUri(uri);
    setLoading(false);
  };

  const loadVideoFile = async () => {
    const uri = await downloadFileToCache(announcementId, filename);
    setFileUri(uri);
    setLoading(false);
  };

  const loadTextFile = async () => {
    const uri = await downloadFileToCache(announcementId, filename);
    setFileUri(uri);
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: 'utf8',
    } as any);
    setFileDataText(content);
    setLoading(false);
  };

  const loadPdfFile = async () => {
    const uri = await downloadFileToCache(announcementId, filename);
    setFileUri(uri);
    // When previewing, read as base64 for the PDF.js viewer
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: (FileSystem as any).EncodingType?.Base64 ?? (FileSystem as any).EncodingType ?? 'base64',
    } as any);
    setFileBase64(base64);
    setLoading(false);
  };

  const loadOfficeFile = async () => {
    const uri = await downloadFileToCache(announcementId, filename);
    setFileUri(uri);
    setLoading(false);
  };

  const cleanup = async () => {
    if (fileUri) {
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch (err) {
        console.log('Cleanup error:', err);
      }
    }
    setFileUri(null);
    setFileDataText(null);
    setFileBase64(null);
    setError(null);
    setLoading(true);
  };

  const handleClose = async () => {
    await cleanup();
    onClose();
  };

  const handleDownload = async () => {
    if (fileUri) {
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: getMimeType(filename),
            dialogTitle: 'Save File',
          });
        } else {
          Alert.alert('Info', 'Cannot save file from this device.');
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to save file.');
      }
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕ Close</Text>
          </TouchableOpacity>

          <Text style={styles.title} numberOfLines={1}>
            {filename}
          </Text>

          {allowDownload && (
            <TouchableOpacity onPress={handleDownload} style={styles.downloadButton}>
              <Text style={styles.downloadText}>💾 Save</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.content}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Loading file...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={loadFile} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && (
            <>
              {fileType === 'image' && fileUri && (
                <Image source={{ uri: fileUri }} style={styles.image} resizeMode="contain" />
              )}

              {fileType === 'video' && fileUri && (
                <Video
                  source={{ uri: fileUri }}
                  style={styles.video}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={false}
                  isLooping={false}
                  useNativeControls
                />
              )}

              {fileType === 'text' && fileDataText && (
                <ScrollView style={styles.textContainer}>
                  <Text style={styles.text}>{fileDataText}</Text>
                </ScrollView>
              )}

              {fileType === 'pdf' && fileBase64 && (
                <WebView
                  originWhitelist={['*']}
                  source={{ html: pdfReaderHtml(fileBase64) }}
                  style={styles.webView}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  onError={(e) => console.error('WebView Error:', e.nativeEvent)}
                />
              )}

              {(fileType === 'office' || fileType === 'unsupported') && (
                 <View style={styles.unsupportedContainer}>
                    <Text style={styles.unsupportedMessage}>
                        Preview is not available for this file type.
                    </Text>
                    {allowDownload && fileUri && (
                        <TouchableOpacity onPress={handleDownload} style={styles.openButton}>
                            <Text style={styles.openButtonText}>Save to Device</Text>
                        </TouchableOpacity>
                    )}
                    <Text style={styles.fileInfo}>File: {filename}</Text>
                 </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const getMimeType = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf': return 'application/pdf';
    case 'doc':
    case 'docx': return 'application/msword';
    case 'xls':
    case 'xlsx': return 'application/vnd.ms-excel';
    case 'ppt':
    case 'pptx': return 'application/vnd.ms-powerpoint';
    case 'txt': return 'text/plain';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'zip': return 'application/zip';
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    default: return 'application/octet-stream';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    color: '#6B7280',
    fontSize: 14,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  downloadButton: {
    padding: 4,
  },
  downloadText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  image: {
    flex: 1,
  },
  video: {
    flex: 1,
  },
  textContainer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  unsupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  unsupportedMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  fileInfo: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  openButton: {
      backgroundColor: '#2563EB',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 8,
  },
  openButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
});
