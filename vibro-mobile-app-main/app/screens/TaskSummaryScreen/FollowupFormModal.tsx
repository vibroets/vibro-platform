import { ToggleContext } from '@/app/(app)/_layout';
import * as Api from '@/services';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import TodoFormScreen from '../Todo/TodoFormScreen';

interface FollowupFormModalProps {
  formId: string;
  taskId: string;
  submissionId?: string;
  formType?: string;
  sourceScreen?: string;
  onClose: () => void;
  onNavigateToTaskClose?: (taskId: string) => void;
}

const FollowupFormModal: React.FC<FollowupFormModalProps> = memo(
  ({
    formId,
    taskId,
    submissionId,
    formType,
    sourceScreen = 'task-summary',
    onClose,
    onNavigateToTaskClose,
  }) => {
  const [resolvedFormType, setResolvedFormType] = useState<string | undefined>(
    formType,
  );

  useEffect(() => {
    setResolvedFormType(formType);
  }, [formType]);

  useEffect(() => {
    let cancelled = false;
    if (resolvedFormType || !formId) return;

    const loadFormType = async () => {
      try {
        const response: any = await Api.get(`/form/${formId}/`);
        const payload = response?.data ?? response;
        const formTypeValue =
          payload?.form_type || payload?.formType || payload?.type;
        if (!cancelled && formTypeValue) {
          setResolvedFormType(String(formTypeValue));
        }
      } catch (error) {
      }
    };

    loadFormType();
    return () => {
      cancelled = true;
    };
  }, [formId, resolvedFormType]);
  const [isToggleEnabled, setIsToggleEnabled] = React.useState(false);
  const [formIdState, setFormId] = React.useState<string | undefined>(undefined);
  const [localSubmissionId, setLocalSubmissionId] = React.useState<string | undefined>(undefined);
  const [showBackButton, setShowBackButton] = React.useState(false);
  const [onBackPress, setOnBackPress] = React.useState<(() => void) | undefined>(undefined);
  const [formOptions, setFormOptions] = React.useState<{ enabled: boolean; onEdit?: () => void; onShare?: () => void; onPdf?: () => void }>({ enabled: false });

  // Memoize the close handler to prevent unnecessary re-renders
  const handleFormClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Memoize the navigation handler
  const handleNavigateToTaskClose = useCallback((tid: string) => {
    if (onNavigateToTaskClose) {
      onNavigateToTaskClose(tid);
    }
  }, [onNavigateToTaskClose]);

  const contextValue = React.useMemo(() => ({
    isToggleEnabled,
    setIsToggleEnabled,
    formOptions,
    setFormOptions,
    formId: formIdState,
    setFormId,
    submissionId: localSubmissionId,
    setSubmissionId: setLocalSubmissionId,
    showBackButton,
    setShowBackButton,
    onBackPress,
    setOnBackPress,
  }), [isToggleEnabled, formOptions, formIdState, localSubmissionId, showBackButton, onBackPress]);

  return (
    <ToggleContext.Provider value={contextValue}>
      <View style={styles.container}>
        <TodoFormScreen
          formId={formId}
          taskId={taskId}
          submissionId={submissionId}
          formType={resolvedFormType}
          sourceScreen={sourceScreen}
          onClose={handleFormClose}
          onNavigateToTaskClose={handleNavigateToTaskClose}
        />
      </View>
    </ToggleContext.Provider>
  );
});

FollowupFormModal.displayName = 'FollowupFormModal';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
});

export default FollowupFormModal;
