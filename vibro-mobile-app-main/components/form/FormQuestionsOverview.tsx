import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import formData from '../../answer.json';
import { getFormulaDisplayText } from './utils/formulaHelpers';

interface Question {
  question: string;
  question_type: string;
  question_uuid: string;
  order: number;
  is_required: boolean;
  question_hint?: string;
  description?: string;
  options?: Array<{option: string; order: number}>;
  sub_questions?: Question[];
  logics?: Array<{
    logic_type: string;
    logic_value: string;
    order: number;
    logic_questions: Question[];
    follow_up: {
      title: string;
      task_close_questions: Question[];
    };
  }>;
  min_value?: number;
  max_value?: number;
  number_of_file_allowed?: number;
  require_live?: boolean;
  formula?: string;
  is_other?: boolean;
  question_sub_type?: string;
}

interface Stage {
  name: string;
  order: number;
  questions: Question[];
}

interface FormData {
  form_type: string;
  title: string;
  stages: Stage[];
}

const FormQuestionsOverview: React.FC = () => {
  const allQuestions = formData.stages.flatMap((stage) => stage.questions);

  const renderQuestion = (question: Question, prefix: string) => {
    return (
      <View key={question.question_uuid} style={styles.questionContainer}>
        <Text style={styles.questionText}>
          {prefix} {question.question}
        </Text>
        <Text style={styles.questionMeta}>
          Type: {question.question_type} | Required: {question.is_required ? 'Yes' : 'No'}
        </Text>

        {question.question_hint && (
          <Text style={styles.questionHint}>Hint: {question.question_hint}</Text>
        )}

        {question.description && (
          <Text style={styles.questionDescription}>{question.description}</Text>
        )}

        {/* Question-specific properties */}
        {question.question_type === 'table' && question.min_value && question.max_value && (
          <Text style={styles.questionDetail}>Table Range: {question.min_value} - {question.max_value}</Text>
        )}

        {question.question_type === 'linear_scale' && question.min_value && question.max_value && (
          <Text style={styles.questionDetail}>Scale: {question.min_value} - {question.max_value}</Text>
        )}

        {(question.question_type === 'upload_image' || question.question_type === 'upload_video' || question.question_type === 'upload_file') && (
          <View style={styles.uploadDetails}>
            {question.number_of_file_allowed && (
              <Text style={styles.questionDetail}>Max files: {question.number_of_file_allowed}</Text>
            )}
            {question.require_live && (
              <Text style={styles.questionDetail}>📹 Live capture required</Text>
            )}
          </View>
        )}

        {question.question_type === 'formula' && question.formula && (
          <Text style={styles.questionDetail}>
            Formula: {getFormulaDisplayText(question.formula, allQuestions)}
          </Text>
        )}

        {/* Options for multiple choice, dropdown, checkboxes */}
        {(question.question_type === 'dropdown' || question.question_type === 'multiple_choice' || question.question_type === 'checkboxes') && question.options && (
          <View style={styles.optionsContainer}>
            <Text style={styles.optionsTitle}>Options:</Text>
            {question.options.map((option, index) => (
              <Text key={index} style={styles.optionText}>• {option.option}</Text>
            ))}
            {question.is_other && <Text style={styles.optionText}>• Other (custom option)</Text>}
          </View>
        )}

        {/* Sub-questions for table type */}
        {question.question_type === 'table' && question.sub_questions && question.sub_questions.length > 0 && (
          <View style={styles.subQuestionsContainer}>
            <Text style={styles.subQuestionsTitle}>Sub-questions:</Text>
            {question.sub_questions.map((subQ, index) => renderQuestion(subQ, `${index + 1}.`))}
          </View>
        )}

        {/* Logic rules */}
        {question.logics && question.logics.length > 0 && (
          <View style={styles.logicContainer}>
            <Text style={styles.logicTitle}>Logic Rules:</Text>
            {question.logics.map((logic, logicIndex) => (
              <View key={logicIndex} style={styles.logicRule}>
                <Text style={styles.logicText}>
                  If "{logic.logic_value}" then:
                </Text>

                {logic.logic_questions && logic.logic_questions.length > 0 && (
                  <View style={styles.logicQuestions}>
                    <Text style={styles.logicSubTitle}>Additional Questions:</Text>
                    {logic.logic_questions.map((logicQ, index) => renderQuestion(logicQ, `${index + 1}.`))}
                  </View>
                )}

                {logic.follow_up && (
                  <View style={styles.followUpContainer}>
                    <Text style={styles.followUpTitle}>Follow-up: {logic.follow_up.title}</Text>
                    {logic.follow_up.task_close_questions && logic.follow_up.task_close_questions.length > 0 && (
                      <View style={styles.taskCloseContainer}>
                        <Text style={styles.taskCloseTitle}>Task Close Questions:</Text>
                        {logic.follow_up.task_close_questions.map((taskQ, index) => renderQuestion(taskQ, `${index + 1}.`))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderStage = (stage: Stage) => {
    return (
      <View key={stage.order} style={styles.stageContainer}>
        <Text style={styles.stageTitle}>🏁 STAGE {stage.order}: {stage.name}</Text>

        {stage.questions.length === 0 ? (
          <Text style={styles.noQuestions}>No questions in this stage</Text>
        ) : (
          stage.questions.map((question) => renderQuestion(question, `${question.order}.`))
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>📋 FORM QUESTIONS OVERVIEW</Text>
      <Text style={styles.formTitle}>{formData.title}</Text>
      <Text style={styles.formMeta}>Type: {formData.form_type} | Stages: {formData.stages.length}</Text>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>📊 FORM SUMMARY</Text>
        <Text style={styles.summaryText}>Pass Percentage: {formData.pass_percentage}%</Text>
        <Text style={styles.summaryText}>Max Score: {formData.max_score}</Text>
      </View>

      {formData.stages.map(renderStage)}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Total Stages: {formData.stages.length} | Questions: {formData.stages.reduce((total, stage) => total + stage.questions.length, 0)}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#2c3e50',
  },
  formMeta: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#7f8c8d',
  },
  summaryContainer: {
    backgroundColor: '#ecf0f1',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#34495e',
  },
  summaryText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  stageContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2c3e50',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    paddingBottom: 8,
  },
  questionContainer: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#34495e',
  },
  questionMeta: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  questionHint: {
    fontSize: 14,
    color: '#e74c3c',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  questionDescription: {
    fontSize: 14,
    color: '#3498db',
    marginBottom: 4,
  },
  questionDetail: {
    fontSize: 13,
    color: '#95a5a6',
    marginTop: 2,
  },
  optionsContainer: {
    marginTop: 8,
  },
  optionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#34495e',
  },
  optionText: {
    fontSize: 13,
    color: '#7f8c8d',
    marginLeft: 8,
  },
  subQuestionsContainer: {
    marginTop: 8,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#bdc3c7',
  },
  subQuestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#34495e',
  },
  logicContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
  },
  logicTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#e67e22',
  },
  logicRule: {
    marginBottom: 8,
  },
  logicText: {
    fontSize: 13,
    color: '#d35400',
    marginBottom: 4,
  },
  logicQuestions: {
    marginLeft: 8,
    marginBottom: 4,
  },
  logicSubTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    color: '#34495e',
  },
  followUpContainer: {
    marginLeft: 8,
    marginTop: 4,
  },
  followUpTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e44ad',
    marginBottom: 4,
  },
  taskCloseContainer: {
    marginLeft: 8,
  },
  taskCloseTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    color: '#34495e',
  },
  uploadDetails: {
    marginTop: 4,
  },
  noQuestions: {
    fontSize: 14,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  footer: {
    padding: 16,
    backgroundColor: '#2c3e50',
    borderRadius: 8,
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#ecf0f1',
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default FormQuestionsOverview;
