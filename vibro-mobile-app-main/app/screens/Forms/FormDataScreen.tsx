import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Accordion from "@/components/form/Accordion/Accordion";
import StageIndicator from "@/components/form/Accordion/StageIndicator";
import FormField from "@/components/form/FormFields/FormField";
import { Stage } from "@/components/form/types/formTypes";
import api from "@/services";
import { FORM, GETFORMSUBMISSIONDETAILS } from "@/services/constants";

interface User {
  id: number;
  username: string;
}

const FormDataScreen = () => {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const formId = params.formId as string;
  const submissionId = params.submissionId as string;

  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);

  const completedByUser = null; // These would come from submission details

  const getFormData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let stagesToSet: Stage[] = [];
      let titleToSet = "";

      if (submissionId) {
        const detailResponse = await api.get(`${GETFORMSUBMISSIONDETAILS}${formId}/${submissionId}`);
        const subDetail = detailResponse.data?.submissionsDetail;
        stagesToSet = (detailResponse.data.stages || (detailResponse.data.form_type === "audit" ? detailResponse.data.audit_group : detailResponse.data.stages)).map((stage: Stage) => ({
          ...stage,
          updated: stage.edited_on ? true : false,
        }));

        titleToSet = subDetail?.form_title || subDetail?.form_name || "Form Submission";

        // Set completed stages
        const completed = stagesToSet
          .map((stage: Stage, index: number) => (stage.is_completed ? index : -1))
          .filter((index: number) => index >= 0);
        setCompletedStages(completed);
      } else {
        // If no submissionId, just get form structure
        const formResponse = await api.get(`${FORM}${formId}/`);
        titleToSet = formResponse.data.name || formResponse.data.title || "Form";
        stagesToSet = (formResponse.data.form_type === "audit" ? formResponse.data.audit_group : formResponse.data.stages).map((stage: Stage) => ({
          ...stage,
          updated: false,
        }));
      }

      setStages(stagesToSet);
      setFormTitle(titleToSet);

      // Load users for display
      try {
        const usersResponse = await api.get("/users/");
        setUsers(usersResponse.data || []);
      } catch (error) {

      }

    } catch (error: any) {
      setError("Failed to load form data. Please check your permissions or try again.");
    } finally {
      setLoading(false);
    }
  }, [formId, submissionId]);

  useEffect(() => {
    getFormData();
  }, [getFormData]);

  const currentStage = stages[currentStageIndex];

  const renderQuestion = useCallback((question: any) => {
    return (
      <FormField
        key={question.question_uuid}
        question={question}
        control={{}} // Empty control for view-only
        errors={{}} // No errors in view mode
        isCompleted={true}
        allValues={{}} // No values to pass for view
        allQuestions={currentStage?.questions || []}
        setValue={() => {}} // No-op for view mode
        hasError={false}
        isEditable={false} // View-only mode
      />
    );
  }, [currentStage]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={getFormData}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!stages.length) {
    return (
      <View style={styles.loadingContainer}>
        <Text>No form data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <Text style={styles.formTitle}>{formTitle}</Text>

      <View style={styles.stageIndicator}>
        <StageIndicator
          stages={stages}
          currentStageIndex={currentStageIndex}
          completedStages={completedStages}
          onStagePress={(index) => setCurrentStageIndex(index)}
          isToggleEnabled={false}
          isFormAssignedToUser={true}
          onStageMenuPress={() => {}}
        />
      </View>

      <Accordion
        title={currentStage?.name || "Form Data"}
        isCompleted={completedStages.includes(currentStageIndex)}
      >
        {currentStage?.questions?.map((question: any) => renderQuestion(question)) || (
          <Text style={styles.noDataText}>No questions available</Text>
        )}
      </Accordion>

      {(currentStage?.is_completed || currentStage?.edited_on) && (
        <View style={styles.completedInfo}>
          {currentStage?.is_completed && (
            <View style={styles.completedSection}>
              <Text style={styles.sectionHeaderText}>Completed</Text>
              {currentStage.completed_on && (
                <View style={styles.infoRow}>
                  <Text style={styles.completedText}>
                    Completed on: {new Date(currentStage.completed_on).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    padding: 5,
    backgroundColor: "#fff",
  },
  formTitle: {
    fontSize: 24,
    color: "#6200ee",
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 16,
  },
  questionContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2196f3",
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  hintText: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
    marginTop: 6,
  },
  answerContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2196f3",
    marginBottom: 4,
  },
  answerText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  stageIndicator: {
    marginTop: 10,
    marginBottom: 10,
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#ff4444",
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  noDataText: {
    textAlign: "center",
    fontStyle: "italic",
    color: "gray",
    padding: 20,
  },
  completedInfo: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 10,
  },
  completedSection: {
    marginBottom: 15,
  },
  sectionHeaderText: {
    fontSize: 18,
    color: "#6200ee",
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  completedText: {
    fontSize: 14,
    color: "#1f2937",
    flex: 1,
    flexWrap: "wrap",
  },
});

export default FormDataScreen;
