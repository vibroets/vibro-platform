import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import TodoFormScreen from '../screens/Todo/TodoFormScreen';

export default function FormEntry() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  
  // Normalize params to strings
  const toStr = (v: string | string[] | undefined) =>
    Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

  const initial = useMemo(() => ({
    formId: toStr(params.formId),
    taskId: toStr(params.taskId),
    submissionId: toStr(params.submissionId) || undefined,
    draftId: toStr(params.draftId) || undefined,
    formType: toStr(params.formType) || undefined,
    sourceScreen: toStr(params.sourceScreen) || undefined,
    mode: toStr(params.mode) || undefined,
  }), [params]);

  const [formId, setFormId] = useState(initial.formId);
  const [mode, setMode] = useState<string | undefined>(initial.mode);

  const handleClose = () => {
    router.back();
  };

  const handleNavigateToTaskClose = (taskId: string) => {
    // Switch this screen to task close questions mode without leaving the route
    setMode('task-close-questions');
    setFormId('task-close-questions');
  };

  // If no taskId is provided, show an error
  if (!initial.taskId) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invalid Navigation</Text>
          <Text style={styles.errorSubtext}>No task ID provided</Text>
          <Text style={styles.debugText}>Params: {JSON.stringify(params)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {initial.taskId && (
        <TodoFormScreen
          formId={formId}
          taskId={initial.taskId}
          submissionId={initial.submissionId}
          draftId={initial.draftId}
          formType={initial.formType}
          sourceScreen={initial.sourceScreen}
          mode={mode}
          onClose={handleClose}
          onNavigateToTaskClose={handleNavigateToTaskClose}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  debugText: {
    fontSize: 12,
    color: '#adb5bd',
    textAlign: 'center',
  },
});
