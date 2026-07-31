import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import api from "@/services";

interface RelatedTask {
  id: number;
  task_name?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

interface RelatedTasksSelectorProps {
  visible: boolean;
  taskId: string;
  onClose: () => void;
  onConfirm: (selectedIds: number[]) => void;
  title?: string;
  subtitle?: string;
}

const RelatedTasksSelector: React.FC<RelatedTasksSelectorProps> = ({
  visible,
  taskId,
  onClose,
  onConfirm,
  title = "Related Tasks Available",
  subtitle = "These tasks have the same Location & Question. Select which ones to close.",
}) => {
  const [tasks, setTasks] = useState<RelatedTask[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !taskId) return;
    fetchRelatedTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, taskId]);

  const fetchRelatedTasks = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/tasks/${taskId}/related_tasks/`);
      const taskList = response.data?.tasks || response.data || [];
      setTasks(taskList);
      const allSelected: Record<number, boolean> = {};
      taskList.forEach((t: RelatedTask) => {
        allSelected[t.id] = true;
      });
      setSelected(allSelected);
    } catch (e) {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (id: number) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleAll = () => {
    const allSelected = tasks.every((t) => selected[t.id]);
    const next: Record<number, boolean> = {};
    tasks.forEach((t) => {
      next[t.id] = !allSelected;
    });
    setSelected(next);
  };

  const handleConfirm = () => {
    const selectedIds = tasks.filter((t) => selected[t.id]).map((t) => t.id);
    onConfirm(selectedIds);
  };

  const handleClose = () => {
    onConfirm([]);
  };

  const renderItem = ({ item }: { item: RelatedTask }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => toggleTask(item.id)}
      activeOpacity={0.7}
    >
      <Icon
        name={selected[item.id] ? "check-box" : "check-box-outline-blank"}
        size={24}
        color="#2196f3"
      />
      <View style={styles.itemTextContainer}>
        <Text style={styles.itemName}>
          {item.task_name || `Task #${item.id}`}
        </Text>
        {item.status ? (
          <Text style={styles.itemMeta}>Status: {item.status}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {loading ? (
            <ActivityIndicator
              size="large"
              color="#2196f3"
              style={styles.loader}
            />
          ) : (
            <>
              <FlatList
                data={tasks}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                ListEmptyComponent={
                  <Text style={styles.empty}>No related tasks found.</Text>
                }
                style={styles.list}
              />

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={handleToggleAll}
                >
                  <Text style={styles.toggleText}>Select / Deselect All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleClose}
                >
                  <Text style={styles.cancelText}>Cancel Auto-Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmText}>Close Selected</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 12,
    lineHeight: 18,
  },
  loader: {
    marginVertical: 20,
  },
  list: {
    maxHeight: 300,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  itemTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  itemMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  empty: {
    textAlign: "center",
    color: "#94A3B8",
    padding: 20,
  },
  actions: {
    marginTop: 16,
    gap: 8,
  },
  toggleBtn: {
    padding: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    alignItems: "center",
  },
  toggleText: {
    color: "#1D4ED8",
    fontWeight: "600",
  },
  cancelBtn: {
    padding: 12,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    alignItems: "center",
  },
  cancelText: {
    color: "#475569",
    fontWeight: "600",
  },
  confirmBtn: {
    padding: 12,
    backgroundColor: "#2196f3",
    borderRadius: 8,
    alignItems: "center",
  },
  confirmText: {
    color: "#fff",
    fontWeight: "700",
  },
});

export default RelatedTasksSelector;
