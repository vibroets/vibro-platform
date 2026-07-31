import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  ScrollView,
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
  first_name: string;
  last_name: string;
  email?: string;
}

interface TodoFormDataScreenProps {
  selectedTask?: any;
  onBack?: () => void;
}

const TodoFormDataScreen: React.FC<TodoFormDataScreenProps> = ({ selectedTask, onBack }) => {
  const navigation = useNavigation();
  const params = useLocalSearchParams();

  // Handle back button press for sent todo screen
  const handleBackPress = useCallback(() => {
    // For sent todo, we need to go back to the sent todo list
    // This is called from sent-todo.tsx which handles the selectedTask state
    if (onBack) {
      // Use the provided callback to go back
      onBack();
    } else if (selectedTask) {
      // This will be handled by the parent component (sent-todo.tsx)
      // We need to trigger the back action through the parent
      // For now, let's use navigation.goBack() if available
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } else {
      // Fallback to router back
      router.back();
    }
    return true;
  }, [selectedTask, navigation, onBack]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [handleBackPress]);

  // Get parameters from props (when called from todo screens) or from params (when called via routing)
  const formId = selectedTask?.formId || (params.formId as string);
  const taskId = selectedTask?.taskId || selectedTask?.submissionId || (params.taskId as string);

  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [taskData, setTaskData] = useState<any>(null);

  const completedByUser = null; // These would come from submission details

  const getTaskData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get task details first (optional for completed forms)
      let taskData = null;
      try {
        const taskResponse = await api.get(`/tasks/${taskId}/`);
        taskData = taskResponse.data;
        setTaskData(taskData);
      } catch (taskError) {
        // Don't set error or return - continue with form data
        taskData = null;
      }

      const taskName = taskData?.task_name || taskData?.form_title || selectedTask?.formTitle || "Task";
      setFormTitle(taskName);

      let stagesToSet: Stage[] = [];

      // For completed forms, we have formId and submissionId from props/params
      // Try to get form submission details directly
      const submissionId = selectedTask?.submissionId || params.submissionId as string;

      if (submissionId) {
        // If we have a submission ID, get form submission details
        try {
          // console.log(`Fetching form submission details: ${GETFORMSUBMISSIONDETAILS}${formId}/${submissionId}`);
          const detailResponse = await api.get(`${GETFORMSUBMISSIONDETAILS}${formId}/${submissionId}`);
          const submissionData = detailResponse.data;

          stagesToSet = (submissionData.stages || (submissionData.form_type === "audit" ? submissionData.audit_group : submissionData.stages) || []).map((stage: Stage) => ({
            ...stage,
            updated: stage.edited_on ? true : false,
          }));

          // After submission, don't show pending stages on received todo
          // If all stages are completed, show empty stages list (task completed)
          const allStagesCompleted = stagesToSet.every((stage: any) => stage.is_completed);

          if (allStagesCompleted) {
            stagesToSet = [];
            setCompletedStages([]);
          } else {
            // Show only pending stages for completion
            const pendingStagesOnly = stagesToSet.filter((stage: any) => !stage.is_completed);
            // console.log(`Total stages: ${stagesToSet.length}, Pending stages: ${pendingStagesOnly.length}`);

            // Update stages to include only pending stages
            stagesToSet = pendingStagesOnly.map((stage, index) => ({
              ...stage,
              order: index + 1, // Re-order pending stages starting from 1
            }));

            // Set completed stages as empty since we're only showing pending stages
            setCompletedStages([]);
          }

          // Start from first pending stage (now index 0)
          setCurrentStageIndex(0);
        } catch (submissionError) {
          setError("Form submission data not available.");
          return;
        }
      } else if (taskData?.form_submission_id) {
        // Fallback: If we have task data with submission ID, use that
        try {
          // console.log(`Fetching form submission details from task data: ${GETFORMSUBMISSIONDETAILS}${taskData.form_id || formId}/${taskData.form_submission_id}`);
          const detailResponse = await api.get(`${GETFORMSUBMISSIONDETAILS}${taskData.form_id || formId}/${taskData.form_submission_id}`);
          const submissionData = detailResponse.data;

          stagesToSet = (submissionData.stages || (submissionData.form_type === "audit" ? submissionData.audit_group : submissionData.stages) || []).map((stage: Stage) => ({
            ...stage,
            updated: stage.edited_on ? true : false,
          }));

          // For Todo forms, show all stages (don't filter out completed ones)
          // This ensures consistency with the form filling experience
          const allStages = stagesToSet.map((stage, index) => ({
            ...stage,
            order: index + 1, // Keep original ordering
          }));

          // Update stages to include all stages
          stagesToSet = allStages;

          // Set completed stages based on actual completion status
          const completedStageIndices = stagesToSet
            .map((stage: Stage, index: number) => (stage.is_completed ? index : -1))
            .filter((index: number) => index >= 0);
          setCompletedStages(completedStageIndices);

          setCurrentStageIndex(0);
        } catch (submissionError) {
          setError("Form data not available for this task.");
          return;
        }
      } else {
        // No submission data available
        setError("No form submission data available.");
        return;
      }

      setStages(stagesToSet);

      // Load users for display (optional - don't fail if this fails)
      try {
        const usersResponse = await api.get("/users/");
        setUsers(usersResponse.data || []);
      } catch (error) {
        // Users loading failed, but continue without users data
        setUsers([]);
      }

    } catch (error: any) {
      setError(error?.message || "Failed to load task data. Please check your permissions or try again.");
    } finally {
      setLoading(false);
    }
  }, [formId, taskId]);

  useEffect(() => {
    getTaskData();
  }, [getTaskData]);

  const currentStage = stages[currentStageIndex];

  const renderQuestion = useCallback((question: any) => {
    // For displaying submitted answers, we need to populate the question with the submitted answer
    // First, try to find the submitted answer in the question data
    let submittedAnswer = question.answer || question.value || question.submitted_value;

    // If still no answer, check if answers is an array or object
    if ((submittedAnswer === null || submittedAnswer === undefined || submittedAnswer === '') && question.answers) {
      if (Array.isArray(question.answers) && question.answers.length > 0) {
        // If answers is an array, take the first answer
        submittedAnswer = question.answers[0].answer || question.answers[0].value || question.answers[0].submitted_value || question.answers[0];
      } else if (typeof question.answers === 'object' && question.answers !== null) {
        // If answers is an object, try to get the answer from it
        submittedAnswer = question.answers.answer || question.answers.value || question.answers.submitted_value;
      }
    }

    // Additional check: look for answer in nested structures
    if ((submittedAnswer === null || submittedAnswer === undefined || submittedAnswer === '')) {
      // Check for answer in submission-related fields
      if (question.submission_answer) {
        submittedAnswer = question.submission_answer;
      } else if (question.user_answer) {
        submittedAnswer = question.user_answer;
      } else if (question.response) {
        submittedAnswer = question.response;
      } else if (question.response_value) {
        submittedAnswer = question.response_value;
      }

      // Check for nested answer structures
      if ((submittedAnswer === null || submittedAnswer === undefined || submittedAnswer === '') && question.answer_data) {
        submittedAnswer = question.answer_data.answer || question.answer_data.value;
      }

      // Check if there's a direct answer field in some other structure
      if ((submittedAnswer === null || submittedAnswer === undefined || submittedAnswer === '') && question.data) {
        submittedAnswer = question.data.answer || question.data.value;
      }
    }

    // Format answer based on question type for read-only display
    const formatAnswer = (answer: any, questionType: string) => {
      if (answer === null || answer === undefined || answer === '') {
        return 'No answer provided';
      }

      // Handle different question types
      switch (questionType) {
        case 'checkboxes':
          if (Array.isArray(answer)) {
            return answer.join(', ');
          }
          if (typeof answer === 'string' && answer.includes('|')) {
            return answer.split('|').filter(v => v.trim() !== '').join(', ');
          }
          return String(answer);

        case 'multiple_choice':
          if (Array.isArray(answer)) {
            return answer.join(', ');
          }
          return String(answer);

        case 'upload_file':
        case 'upload_image':
        case 'upload_video':
        case 'upload_audio':
          if (typeof answer === 'object' && (answer.file_name || answer.filename)) {
            return `📎 ${answer.file_name || answer.filename}`;
          }
          if (Array.isArray(answer)) {
            return `📎 ${answer.length} file(s) uploaded`;
          }
          return '📎 File uploaded';

        case 'location':
          if (typeof answer === 'object' && answer.latitude && answer.longitude) {
            return `📍 Location: ${answer.latitude.toFixed(4)}, ${answer.longitude.toFixed(4)}`;
          }
          return String(answer);

        case 'signature':
          return '✍️ Signature provided';

        case 'date':
        case 'datetime':
        case 'time':
          if (answer instanceof Date) {
            return answer.toLocaleString();
          }
          if (typeof answer === 'string') {
            const date = new Date(answer);
            if (!isNaN(date.getTime())) {
              return questionType === 'date' ? date.toLocaleDateString() : date.toLocaleString();
            }
          }
          return String(answer);

        default:
          // Handle arrays and objects
          if (Array.isArray(answer)) {
            return answer.join(', ');
          }
          if (typeof answer === 'object') {
            // Try to find a display value
            if (answer.label) return answer.label;
            if (answer.value) return answer.value;
            if (answer.text) return answer.text;
            // Last resort stringify
            return JSON.stringify(answer);
          }
          return String(answer);
      }
    };

    return (
      <View key={question.question_uuid} style={styles.questionContainer}>
        <Text style={styles.questionLabel}>
          {question.question} {question.is_required ? '*' : ''}
        </Text>
        {question.question_hint && (
          <Text style={styles.hintText}>{question.question_hint}</Text>
        )}
        <View style={styles.answerContainer}>
          <Text style={styles.answerLabel}>Answer:</Text>
          <Text style={styles.answerText}>
            {formatAnswer(submittedAnswer, question.question_type)}
          </Text>
        </View>
      </View>
    );
  }, []);

  const handleOpenForm = () => {
    // Navigate to the actual form for completion
    // Include main form ID for followup task context
    const mainFormId = taskData?.followup_task_form_id || formId;

    router.push({
      pathname: "/(app)/(tabs)/forms/todo-multi-stage-form",
      params: {
        formId,
        taskId,
        mainFormId, // Pass main form ID for followup task context
      },
    });
  };

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
        <TouchableOpacity style={styles.retryButton} onPress={getTaskData}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!stages.length) {
    return (
      <View style={styles.loadingContainer}>
        <Text>No task data available</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screenContainer}
      showsVerticalScrollIndicator={true}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.formTitle}>{formTitle}</Text>

      {(taskData?.start_date || taskData?.end_date) && (
        <View style={styles.dateContainer}>
          {taskData?.start_date && (
            <Text style={styles.dateText}>
              Start Date: {new Date(taskData.start_date).toLocaleDateString()}
            </Text>
          )}
          {taskData?.end_date && (
            <Text style={styles.dateText}>
              End Date: {new Date(taskData.end_date).toLocaleDateString()}
            </Text>
          )}
        </View>
      )}

      <View style={styles.stageIndicator}>
        <StageIndicator
          stages={stages}
          currentStageIndex={currentStageIndex}
          completedStages={completedStages}
          onStagePress={(index) => {
            setCurrentStageIndex(index);
          }}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: 5,
  },
  formTitle: {
    fontSize: 24,
    color: "#6200ee",
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 16,
  },
  dateContainer: {
    alignItems: "center",
    marginVertical: 8,
  },
  dateText: {
    fontSize: 16,
    color: "#333",
    marginVertical: 2,
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
});

export default TodoFormDataScreen;
