import TaskCloseQuestionsScreen from '@/app/(app)/(tabs)/forms/task-close-questions';
import { ToggleContext } from '@/app/(app)/_layout';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

interface TaskCloseQuestionsModalProps {
  taskId: string;
  onClose: () => void;
}

const TaskCloseQuestionsModal: React.FC<TaskCloseQuestionsModalProps> = ({
  taskId,
  onClose
}) => {
  const [isToggleEnabled, setIsToggleEnabled] = useState(false);
  const [formIdState, setFormId] = useState<string | undefined>(undefined);
  const [submissionId, setSubmissionId] = useState<string | undefined>(undefined);
  const [showBackButton, setShowBackButton] = useState(false);
  const [onBackPress, setOnBackPress] = useState<(() => void) | undefined>(undefined);
  const [formOptions, setFormOptions] = useState<{ enabled: boolean; onEdit?: () => void; onShare?: () => void; onPdf?: () => void }>({ enabled: false });

  return (
    <ToggleContext.Provider
      value={{
        isToggleEnabled,
        setIsToggleEnabled,
        formOptions,
        setFormOptions,
        formId: formIdState,
        setFormId,
        submissionId,
        setSubmissionId,
        showBackButton,
        setShowBackButton,
        onBackPress,
        setOnBackPress,
      }}
    >
      <View style={styles.container}>
        <TaskCloseQuestionsScreen 
          onClose={onClose}
          taskId={taskId}
        />
      </View>
    </ToggleContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
});

export default TaskCloseQuestionsModal;
