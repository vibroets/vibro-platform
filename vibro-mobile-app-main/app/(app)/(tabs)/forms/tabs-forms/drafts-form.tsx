import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import Card from "../../../../../components/Card";
import { DraftData, offlineStorageService } from "../../../../../services/offlineStorageService";
import { RootState } from "../../../../../store";

interface DraftItemProps {
  draft: DraftData;
  onResume: (draft: DraftData) => void;
  onDelete: (draftId: string) => void;
}

const DraftItem: React.FC<DraftItemProps> = ({ draft, onResume, onDelete }) => {
  const handleDelete = () => {
    Alert.alert(
      "Delete Draft",
      "Are you sure you want to delete this draft? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete(draft.id) },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    // Format as: 23 Nov 2025, 10:45
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

  return (
    <View style={styles.draftItem}>
      <View style={styles.draftContent}>
        <View style={styles.draftHeader}>
          <Text style={styles.draftTitle} numberOfLines={1}>
            {draft.formTitle}
          </Text>
          <Text style={styles.draftDate}>{formatDate(draft.timestamp)}</Text>
        </View>
        <View style={styles.draftMeta}>
          {draft.sourceScreen === 'audit' ? (
            <Text style={styles.draftProgress}>Audit Form</Text>
          ) : (
            <Text style={styles.draftProgress}>
              {`Stage ${draft.currentStageIndex + 1} • ${draft.completedStages.length} completed`}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.draftActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.resumeButton]}
          onPress={() => onResume(draft)}
        >
          <MaterialIcons name="play-arrow" size={20} color="white" />
          <Text style={styles.actionButtonText}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
        >
          <MaterialIcons name="delete" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function DraftsForm() {
  const [drafts, setDrafts] = useState<DraftData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = useSelector((state: RootState) => state.user);

  const loadDrafts = useCallback(async () => {
    try {
      if (!user?.id) return;

      // Load drafts from both database and local storage
      const allDrafts = await offlineStorageService.getAllDraftsWithDatabase(user.id);
      const formsDrafts = allDrafts.filter(draft => !draft.sourceScreen?.startsWith('todo'));
      setDrafts(formsDrafts);
    } catch (error) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDrafts();
  }, [loadDrafts]);

  const handleResumeDraft = useCallback((draft: DraftData) => {
    // Navigate to form with draft data
    router.push({
      pathname: "/(app)/(tabs)/forms/multi-stage-form",
      params: {
        formId: draft.formId.toString(),
        draftId: draft.id,
        sourceScreen: draft.sourceScreen || 'drafts',
        formTitle: draft.formTitle || 'Untitled Form',
        formType: draft.formType === 'audit' ? 'audit' : undefined,
        taskId: draft.taskId,
      },
    });
  }, []);

  const handleDeleteDraft = useCallback(async (draftId: string) => {
    try {
      await offlineStorageService.removeDraft(draftId);
      await loadDrafts(); // Refresh the list
    } catch (error) {
      Alert.alert("Error", "Failed to delete draft. Please try again.");
    }
  }, [loadDrafts]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  // Refresh drafts whenever this screen gains focus (e.g., after submitting a draft)
  useFocusEffect(
    useCallback(() => {
      loadDrafts();
    }, [loadDrafts])
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="description" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Drafts Yet</Text>
      <Text style={styles.emptySubtitle}>
        Your form drafts will appear here. Start filling out a form and save it as a draft to continue later.
      </Text>
    </View>
  );

  const renderDraftItem = ({ item }: { item: DraftData }) => (
    <DraftItem
      draft={item}
      onResume={handleResumeDraft}
      onDelete={handleDeleteDraft}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading drafts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cardContainer}>
        <Card title="Form Drafts">
          <FlatList
            data={drafts}
            keyExtractor={(item) => item.id}
            renderItem={renderDraftItem}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            contentContainerStyle={drafts.length === 0 ? styles.emptyListContainer : undefined}
            showsVerticalScrollIndicator={false}
          />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardContainer: {
    flex: 1,
    margin: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  draftItem: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  draftContent: {
    flex: 1,
  },
  draftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  draftTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  draftDate: {
    fontSize: 12,
    color: "#999",
    marginLeft: 8,
  },
  draftMeta: {
    marginBottom: 12,
  },
  draftProgress: {
    fontSize: 14,
    color: "#666",
  },
  draftActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: "center",
  },
  resumeButton: {
    backgroundColor: "#007AFF",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
  },
  actionButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
});
