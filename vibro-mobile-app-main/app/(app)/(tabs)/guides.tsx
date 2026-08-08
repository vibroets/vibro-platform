import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { SecureStoreKeys, SecureStoreService } from "@/services/secureStore";
import api from "@/services";

interface GuideFolder {
  id: number;
  name: string;
  parent: number | null;
  document_count: number;
  has_children: boolean;
}

interface GuideDocument {
  id: number;
  title: string;
  description: string | null;
  folder: number | null;
  folder_name: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number;
  document_type: string;
  uploaded_by_name: string | null;
  allow_download: boolean;
  allow_print: boolean;
  allow_screenshot: boolean;
  created_at: string;
}

export default function GuidesScreen() {
  const [folders, setFolders] = useState<GuideFolder[]>([]);
  const [documents, setDocuments] = useState<GuideDocument[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: number | null; name: string }[]>([{ id: null, name: "Guides" }]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMyGuides = useCallback(async () => {
    try {
      const res = await api.get("/guide-shares/my_guides/");
      const data = res.data;
      if (currentFolderId === null) {
        setFolders((data.folders || []).filter((f: GuideFolder) => f.parent === null));
      } else {
        setFolders((data.folders || []).filter((f: GuideFolder) => f.parent === currentFolderId));
      }
      setDocuments((data.documents || []).filter((d: GuideDocument) => d.folder === currentFolderId));
    } catch (err) {
      console.error("Failed to fetch guides", err);
    }
  }, [currentFolderId]);

  const fetchAll = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    await fetchMyGuides();
    if (showLoader) setLoading(false);
  }, [fetchMyGuides]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMyGuides();
    setRefreshing(false);
  }, [fetchMyGuides]);

  const handleFolderPress = (folder: GuideFolder) => {
    setCurrentFolderId(folder.id);
    setFolderStack([...folderStack, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbPress = (index: number) => {
    const newStack = folderStack.slice(0, index + 1);
    setFolderStack(newStack);
    setCurrentFolderId(newStack[newStack.length - 1].id);
  };

  const handleDocumentPress = async (doc: GuideDocument) => {
    try {
      const authInfo = await SecureStoreService?.get(SecureStoreKeys.AUTH_INFO) as any;
      const token = authInfo?.access;
      if (!token) {
        Alert.alert("Error", "Not authenticated");
        return;
      }
      const downloadUrl = `${api.defaults.baseURL}/guide-documents/${doc.id}/view/`;
      const fileExt = doc.file_type || "pdf";
      const safeTitle = doc.title.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const tempUri = (FileSystem.cacheDirectory || "") + `guide_${Date.now()}_${safeTitle}.${fileExt}`;
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        tempUri,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const result = await downloadResumable.downloadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        Alert.alert("Error", `Could not download document (status: ${result?.status})`);
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: getMimeType(fileExt),
          dialogTitle: doc.title,
        });
      } else {
        Alert.alert("Download Complete", "File saved to app's cache.");
      }
    } catch (err) {
      console.error("Failed to open document", err);
      Alert.alert("Error", "Could not open document");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocTypeColor = (docType: string) => {
    const colors: Record<string, string> = {
      sop: "#3B82F6",
      tutorial: "#10B981",
      qap: "#8B5CF6",
      drawing: "#F59E0B",
      report: "#EF4444",
      other: "#6B7280",
    };
    return colors[docType] || "#6B7280";
  };

  const getDocTypeIcon = (docType: string) => {
    switch (docType) {
      case "sop": return "document-text";
      case "tutorial": return "school";
      case "qap": return "ribbon";
      case "drawing": return "construct";
      case "report": return "analytics";
      default: return "document";
    }
  };

  const renderFolder = ({ item }: { item: GuideFolder }) => (
    <TouchableOpacity
      style={styles.folderItem}
      onPress={() => handleFolderPress(item)}
    >
      <View style={styles.folderIconContainer}>
        <Ionicons name="folder" size={32} color="#3B82F6" />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.folderCount}>{item.document_count} documents</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
    </TouchableOpacity>
  );

  const renderDocument = ({ item }: { item: GuideDocument }) => (
    <TouchableOpacity
      style={styles.docItem}
      onPress={() => handleDocumentPress(item)}
    >
      <View style={[styles.docIconContainer, { backgroundColor: getDocTypeColor(item.document_type) + "20" }]}>
        <Ionicons name={getDocTypeIcon(item.document_type) as any} size={24} color={getDocTypeColor(item.document_type)} />
      </View>
      <View style={styles.docInfo}>
        <Text style={styles.docTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.docMeta} numberOfLines={1}>
          {item.uploaded_by_name} · {formatFileSize(item.file_size)} · {item.file_type?.toUpperCase()}
        </Text>
        {item.description ? (
          <Text style={styles.docDescription} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <View style={styles.docBadges}>
          <View style={[styles.docTypeBadge, { backgroundColor: getDocTypeColor(item.document_type) + "20" }]}>
            <Text style={[styles.docTypeText, { color: getDocTypeColor(item.document_type) }]}>
              {item.document_type.toUpperCase()}
            </Text>
          </View>
          {!item.allow_download && (
            <View style={styles.restrictedBadge}>
              <Ionicons name="lock-closed" size={10} color="#EF4444" />
              <Text style={styles.restrictedText}>No Download</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading guides...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.breadcrumbContainer}>
        {folderStack.map((item, index) => (
          <View key={index} style={styles.breadcrumbItem}>
            {index > 0 && <Ionicons name="chevron-forward" size={12} color="#9CA3AF" />}
            <TouchableOpacity onPress={() => handleBreadcrumbPress(index)}>
              <Text
                style={[
                  styles.breadcrumbText,
                  index === folderStack.length - 1 && styles.breadcrumbActive,
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <FlatList
        data={[...folders, ...documents]}
        keyExtractor={(item, index) =>
          index < folders.length ? `folder-${item.id}` : `doc-${item.id}`
        }
        renderItem={({ item, index }) =>
          index < folders.length
            ? renderFolder({ item: item as GuideFolder })
            : renderDocument({ item: item as GuideDocument })
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No guides shared with you yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  breadcrumbContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  breadcrumbItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  breadcrumbText: {
    fontSize: 13,
    color: "#6B7280",
    paddingHorizontal: 4,
  },
  breadcrumbActive: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  listContent: {
    padding: 12,
  },
  folderItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  folderIconContainer: {
    marginRight: 12,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  folderCount: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  docItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  docIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  docMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3,
  },
  docDescription: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  docBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  docTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docTypeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  restrictedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#FEE2E2",
  },
  restrictedText: {
    fontSize: 10,
    color: "#EF4444",
    fontWeight: "600",
  },
  separator: {
    height: 6,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: "#9CA3AF",
  },
});

const getMimeType = (fileExt: string): string => {
  const ext = fileExt.toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "doc":
    case "docx":
      return "application/msword";
    case "xls":
    case "xlsx":
      return "application/vnd.ms-excel";
    case "ppt":
    case "pptx":
      return "application/vnd.ms-powerpoint";
    case "txt":
      return "text/plain";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "mp4":
      return "video/mp4";
    default:
      return "application/octet-stream";
  }
};
