import AuditFormScreen from "@/components/form/screens/AudiFormScreen";
import MultiStageFormScreen from "@/components/form/screens/MultiStageFormScreen";
import { useLocalSearchParams, router } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function MultiStageForm() {
  const {
    formId,
    submissionId,
    formType,
    stageId,
    formTitle,
    form_title,
    title,
    form_name,
    draftId,
    sourceScreen,
    taskId,
    auditSubmissionData,
    plannerAssignmentId,
    plannerLocation,
    plannerLocationId,
    plannerOrderId,
    collaborativeSubmissionId,
    groupDelegationId,
    groupDelegationStatus,
    auditGroupId,
  } =
    useLocalSearchParams() as any;
  const resolvedFormTitle =
    (typeof formTitle === "string" && formTitle.trim()) ||
    (typeof form_title === "string" && form_title.trim()) ||
    (typeof title === "string" && title.trim()) ||
    (typeof form_name === "string" && form_name.trim()) ||
    "";

  const handleClose = () => {
    router.back();
  };

  // Debug logging
  return (
    <View style={styles.container}>
      {formType == "audit" ? (
          <>
            <AuditFormScreen formId={formId} submissionId={submissionId} draftId={draftId} sourceScreen={sourceScreen} taskId={taskId} auditSubmissionData={auditSubmissionData} onClose={handleClose} plannerAssignmentId={plannerAssignmentId} collaborativeSubmissionId={collaborativeSubmissionId} groupDelegationId={groupDelegationId} groupDelegationStatus={groupDelegationStatus} auditGroupId={auditGroupId} />
          </>
        ) : (
          <>
            {!!resolvedFormTitle && (
              <Text style={styles.formTitle}>{resolvedFormTitle}</Text>
            )}
            <MultiStageFormScreen formId={formId} submissionId={submissionId} stageId={stageId} sourceScreen={sourceScreen} plannerAssignmentId={plannerAssignmentId} plannerLocation={plannerLocation} plannerLocationId={plannerLocationId} plannerOrderId={plannerOrderId} formTitle={resolvedFormTitle} />
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
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  folderContent: {
    fontSize: 16,
    color: "#666",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
