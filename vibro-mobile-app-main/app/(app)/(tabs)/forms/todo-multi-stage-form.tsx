import AuditFormScreen from "@/components/form/screens/AudiFormScreen";
import TodoMultiStageFormScreen from "@/components/form/screens/TodoMultiStageFormScreen";
import { useLocalSearchParams, router } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface TodoMultiStageFormProps {
  formId?: string;
  taskId?: string;
  submissionId?: string;
  formType?: string;
  formTitle?: string;
  sourceScreen?: string;
  onClose?: () => void;
  collaborativeSubmissionId?: string;
  groupDelegationId?: string;
}

export default function TodoMultiStageForm({
  formId: propFormId,
  taskId: propTaskId,
  submissionId: propSubmissionId,
  formType: propFormType,
  formTitle: propFormTitle,
  sourceScreen: propSourceScreen,
  onClose: propOnClose,
  collaborativeSubmissionId: propCollaborativeSubmissionId,
  groupDelegationId: propGroupDelegationId,
}: TodoMultiStageFormProps = {}) {
  const params = useLocalSearchParams() as any;

  // Prioritize props over URL params
  const formId = propFormId || params.formId;
  const taskId = propTaskId || params.taskId;
  const submissionId = propSubmissionId || params.submissionId;
  const formType = propFormType || params.formType;
  const formTitle = propFormTitle || params.formTitle;
  const resolvedFormTitle =
    (typeof formTitle === "string" && formTitle.trim()) ||
    (typeof params.form_title === "string" && params.form_title.trim()) ||
    (typeof params.title === "string" && params.title.trim()) ||
    (typeof params.form_name === "string" && params.form_name.trim()) ||
    "";
  const sourceScreen = propSourceScreen || params.sourceScreen;
  const stageId = params.stageId;
  const draftId = params.draftId;
  const collaborativeSubmissionId = propCollaborativeSubmissionId || params.collaborativeSubmissionId;
  const groupDelegationId = propGroupDelegationId || params.groupDelegationId;

  const handleClose = propOnClose || (() => router.back());

  return (
    <View style={styles.container}>
        {formType === "audit" ? (
          <>
            <AuditFormScreen
              formId={formId}
              submissionId={taskId || submissionId} // Use taskId if available (common in todo context)
              draftId={draftId}
              sourceScreen={sourceScreen}
              onClose={handleClose}
              collaborativeSubmissionId={collaborativeSubmissionId}
              groupDelegationId={groupDelegationId}
            />
          </>
        ) : (
          <>
            {!!resolvedFormTitle && (
              <Text style={styles.formTitle}>{resolvedFormTitle}</Text>
            )}

            <TodoMultiStageFormScreen
              formId={formId}
              taskId={taskId?.toString() || ""}
              submissionId={submissionId}
              sourceScreen={sourceScreen}
              onClose={handleClose}
            />
          </>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: 12,
    marginVertical: 2,
    color: "#2196f3",
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#2196f3",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
});
