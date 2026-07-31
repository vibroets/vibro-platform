import TaskCloseQuestionsScreen from "@/app/(app)/(tabs)/forms/task-close-questions";
import AuditFormScreen from "@/components/form/screens/AudiFormScreen";
import TodoMultiStageFormScreen from "@/components/form/screens/TodoMultiStageFormScreen";
import SearchBar from "@/components/SearchBar";
import React from "react";
import { StyleSheet, View } from "react-native";

interface TodoFormScreenProps {
  formId: string;
  taskId: string;
  submissionId?: string;
  draftId?: string;
  formType?: string;
  sourceScreen?: string;
  mode?: string;
  onClose: () => void;
  onNavigateToTaskClose?: (taskId: string) => void; // Callback for task close navigation
}

interface AuditFormScreenProps {
  formId: string;
  submissionId?: string;
  draftId?: string;
  sourceScreen?: string;
  onClose?: () => void;
}

export default function TodoFormScreen({
  formId,
  taskId,
  submissionId,
  draftId,
  formType,
  sourceScreen,
  mode,
  onClose,
  onNavigateToTaskClose,
}: TodoFormScreenProps) {
  // Handle task close questions mode
  if (mode === 'task-close-questions') {
    return (
      <View style={styles.taskCloseContainer}>
        <TaskCloseQuestionsScreen 
          onClose={onClose} 
          taskId={taskId}
          followupTaskId={submissionId} // Pass submissionId as followupTaskId if needed
        />
      </View>
    );
  }

  const normalizedFormType = String(formType || "").toLowerCase();
  const isAudit = normalizedFormType.includes("audit");

  if (isAudit) {
    return (
      <View style={styles.container}>
        <AuditFormScreen
          formId={formId}
          submissionId={submissionId}
          draftId={draftId}
          taskId={taskId}
          sourceScreen={sourceScreen}
          onClose={onClose}
        />
      </View>
    );
  }

  // For regular todo forms, use TodoMultiStageFormScreen
  return (
    <View style={styles.container}>
      <View style={{ marginBottom: 16, marginHorizontal: 16 }}>
        <SearchBar placeholder="Filter..." />
      </View>
      <TodoMultiStageFormScreen
        formId={formId}
        taskId={taskId}
        submissionId={submissionId}
        draftId={draftId}
        sourceScreen={sourceScreen}
        mode={mode}
        onClose={onClose}
        onNavigateToTaskClose={onNavigateToTaskClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    // margin: 10,
    // backgroundColor: "#fff",
  },
  taskCloseContainer: {
    flex: 1,
    // Remove padding for task close questions to maximize space
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
