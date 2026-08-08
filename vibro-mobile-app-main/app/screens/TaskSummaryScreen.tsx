import StatusBadge from '@/components/StatusBadge';
import * as Api from '@/services';
import { USERS_LIST } from '@/services/constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  InteractionManager,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FollowupFormModal from './TaskSummaryScreen/FollowupFormModal';
import TaskCloseQuestionsModal from './TaskSummaryScreen/TaskCloseQuestionsModal';
import RelatedTasksSelector from '@/components/RelatedTasksSelector';
import { extractLocationSearchText, hasLocationQuestion } from './Todo/tabs-todo/locationFilterUtils';


interface TaskSummaryScreenProps {}

interface ActivityLog {
  id: number;
  action: string;
  action_by: {
    name: string;
  };
  action_to?: {
    name: string;
  };
  created_at: string;
}

interface TaskDetails {
  id: number;
  task_name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  derived_status?: string;
  parent_question?: string;
  activity_logs: ActivityLog[];
  form?: number;
  followup_task_form_id?: number;
  assigned_form_id?: number;
  reopened_remarks?: string | null;
  assignee_names?: { type: string; id: number; name: string }[];
  main_form_submission_id?: number | string | null;
  main_form_location?: string | null;
  is_auto_closed?: boolean;
}

interface ShareUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email?: string;
}

interface ShareGroup {
  id: number;
  name: string;
}

const TaskSummaryScreen: React.FC<TaskSummaryScreenProps> = () => {
  const { taskId, formId, returnTab, viewOnly } = useLocalSearchParams<{
    taskId: string;
    formId?: string;
    returnTab?: string;
    viewOnly?: string;
  }>();
  const isViewOnly = viewOnly === 'true';

  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingTask, setStartingTask] = useState(false);
  const [localActivities, setLocalActivities] = useState<ActivityLog[]>([]);
  const [showTaskCloseTag, setShowTaskCloseTag] = useState(false);
  const [mainFormTitle, setMainFormTitle] = useState<string | null>(null);
  const [mainFormLocation, setMainFormLocation] = useState<string | null>(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareActiveTab, setShareActiveTab] = useState<'users' | 'groups'>('users');
  const [shareUsers, setShareUsers] = useState<ShareUser[]>([]);
  const [shareGroups, setShareGroups] = useState<ShareGroup[]>([]);
  const [shareUserSearch, setShareUserSearch] = useState('');
  const [shareGroupSearch, setShareGroupSearch] = useState('');
  const [shareSelectedUsers, setShareSelectedUsers] = useState<number[]>([]);
  const [shareSelectedGroups, setShareSelectedGroups] = useState<number[]>([]);
  const [shareLoadingUsers, setShareLoadingUsers] = useState(false);
  const [shareLoadingGroups, setShareLoadingGroups] = useState(false);
  const [shareSubmitting, setShareSubmitting] = useState(false);
  
  // Modal states for inline form rendering
  const [showFollowupFormModal, setShowFollowupFormModal] = useState(false);
  const [showTaskCloseQuestionsModal, setShowTaskCloseQuestionsModal] = useState(false);
  const [followupFormId, setFollowupFormId] = useState<string | null>(null);
  const [showRelatedTasksSelector, setShowRelatedTasksSelector] = useState(false);

  // Memoized callback to prevent re-renders
  const handleNavigateToTaskCloseCallback = useCallback((tid: string) => {
    setShowFollowupFormModal(false);
    setShowTaskCloseQuestionsModal(true);
  }, []);

  const resolveReturnRoute = useCallback(() => {
    const tabValue = typeof returnTab === 'string' ? returnTab : '';
    if (tabValue === 'sent') return '/(app)/(tabs)/todo?tab=sent';
    if (tabValue === 'draft') return '/(app)/(tabs)/todo?tab=draft';
    if (tabValue === 'receive') return '/(app)/(tabs)/todo?tab=receive';
    return '/(app)/(tabs)/todo';
  }, [returnTab]);

  const handleBackPress = useCallback(() => {
    if (isViewOnly) {
      router.back();
    } else {
      router.replace(resolveReturnRoute());
    }
  }, [resolveReturnRoute, isViewOnly]);


  useEffect(() => {
    fetchTaskDetails();
  }, [taskId]);

  // Only register hardware back handler while this screen is focused
  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBackPress();
        return true;
      });
      return () => backHandler.remove();
    }, [handleBackPress])
  );

  useEffect(() => {
    if (!showShareModal) return;
    if (shareActiveTab === 'users' && shareUsers.length === 0) {
      fetchShareUsers();
    }
    if (shareActiveTab === 'groups' && shareGroups.length === 0) {
      fetchShareGroups();
    }
  }, [showShareModal, shareActiveTab]);

  const fetchShareUsers = async () => {
    setShareLoadingUsers(true);
    try {
      const response = await Api.get(USERS_LIST);
      const payload = (response as any)?.data ?? response;
      setShareUsers(Array.isArray(payload) ? payload : []);
    } catch (error) {
    } finally {
      setShareLoadingUsers(false);
    }
  };

  const fetchShareGroups = async () => {
    setShareLoadingGroups(true);
    try {
      const response = await Api.get('/groups/');
      const payload = (response as any)?.data ?? response;
      setShareGroups(Array.isArray(payload) ? payload : []);
    } catch (error) {
    } finally {
      setShareLoadingGroups(false);
    }
  };

  const toggleShareUser = (userId: number) => {
    setShareSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleShareGroup = (groupId: number) => {
    setShareSelectedGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const handleShareTask = async () => {
    if (shareSubmitting) return;
    if (shareSelectedUsers.length === 0 && shareSelectedGroups.length === 0) {
      Alert.alert('Share', 'Please select at least one user or group.');
      return;
    }
    try {
      setShareSubmitting(true);
      const payload = {
        users: shareSelectedUsers,
        groups: shareSelectedGroups,
      };
      await Api.post(`/tasks/${taskId}/share/`, payload);
      setShowShareModal(false);
      setShareSelectedUsers([]);
      setShareSelectedGroups([]);
      Alert.alert('Success', 'Task shared successfully.');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to share task');
    } finally {
      setShareSubmitting(false);
    }
  };

  useEffect(() => {
    const loadMainFormTitle = async () => {
      const rawMainFormId: any = taskDetails?.followup_task_form_id;
      const mainFormId = typeof rawMainFormId === 'object' ? rawMainFormId?.id : rawMainFormId;
      if (!mainFormId) {
        setMainFormTitle(null);
        setMainFormLocation(null);
        return;
      }
      try {
        const formResponse = await Api.get<any>(`/form/${mainFormId}/`);
        const title = formResponse?.title || formResponse?.name || null;
        setMainFormTitle(title);

        // Prefer backend-provided location from task details
        if (taskDetails?.main_form_location) {
          setMainFormLocation(String(taskDetails.main_form_location));
          return;
        }

        const formHasLocation = hasLocationQuestion(formResponse);
        if (!formHasLocation) {
          setMainFormLocation(null);
          return;
        }

        // Fallback to fetch submission and extract location
        const submissionId = getMainFormSubmissionId(taskDetails);
        if (!submissionId) {
          setMainFormLocation(null);
          return;
        }

        try {
          const submissionResponse = await Api.get<any>(`/form/response/${mainFormId}/${submissionId}`);
          const submissionData = submissionResponse?.data ?? submissionResponse;
          const locationText = extractLocationSearchText(submissionData);
          setMainFormLocation(locationText || null);
        } catch (err) {
          setMainFormLocation(null);
        }
      } catch {
        setMainFormTitle(null);
        setMainFormLocation(null);
      }
    };

    loadMainFormTitle();
  }, [taskDetails, taskDetails?.followup_task_form_id]);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      const response = await Api.get<TaskDetails>(`/tasks/${taskId}/`);
      setTaskDetails(response);
      setLocalActivities([]);
    } catch (error) {
      Alert.alert('Error', 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async () => {
    if (!taskDetails || taskDetails.status !== 'not_started') return;

    const isFollowupTask =
      taskDetails?.followup_task_form_id !== null &&
      taskDetails?.followup_task_form_id !== undefined;

    // For non-followup tasks, call start API to set in_progress, then open the form
    if (!isFollowupTask) {
      const localActivity: ActivityLog = {
        id: Date.now(),
        action: 'Started',
        action_by: { name: 'You' },
        created_at: new Date().toISOString(),
      };
      setLocalActivities([localActivity, ...localActivities]);

      try {
        setStartingTask(true);
        await Api.patch(`/tasks/${taskId}/start/`);
        await fetchTaskDetails();
      } catch (error) {
        setLocalActivities(prev => prev.filter(a => a.id !== localActivity.id));
        Alert.alert('Error', 'Failed to start task');
      } finally {
        setStartingTask(false);
      }
      return;
    }

    // Add local activity immediately
    const localActivity: ActivityLog = {
      id: Date.now(),
      action: 'Followup_started',
      action_by: { name: 'You' },
      created_at: new Date().toISOString(),
    };
    setLocalActivities([localActivity, ...localActivities]);

    try {
      setStartingTask(true);

      // Call API
      await Api.patch(`/tasks/${taskId}/start_followup/`);
      // Refresh data to replace local activity with server data
      await fetchTaskDetails();

      setTimeout(() => {
      }, 300);
    } catch (error) {
      setLocalActivities(prev => prev.filter(a => a.id !== localActivity.id));
      Alert.alert('Error', 'Failed to start task');
    } finally {
      setStartingTask(false);
    }
  };

  const handleShowTaskCloseTag = () => {
    setShowTaskCloseTag(true);
  };

  const completeTaskWithSelectedIds = async (selectedRelatedIds: number[]) => {
    if (!taskDetails) return;

    try {
      setStartingTask(true);

      const response = await Api.patch(`/tasks/${taskId}/complete/`, {
        close_related_task_ids: selectedRelatedIds
      });

      const relatedTasksClosed = (response as any)?.data?.related_tasks_closed;
      const totalClosed = (relatedTasksClosed?.count ?? 0) + 1;

      if (relatedTasksClosed && relatedTasksClosed.count > 0) {
        const tasksList = relatedTasksClosed.details
          .map((t: any, idx: number) => `${idx + 1}. ${t.task_name || `Task #${t.id}`}`)
          .join('\n');

        Alert.alert(
          '✅ Multiple Tasks Completed',
          `This task and ${relatedTasksClosed.count} related task(s) with the same Location & Question have been closed:\n\n${tasksList}\n\nThis ensures consistency across your workflow.`,
          [
            {
              text: 'OK',
              onPress: () => {
                InteractionManager.runAfterInteractions(() => {
                  router.replace(resolveReturnRoute());
                });
              }
            }
          ]
        );
      } else {
        Alert.alert(
          '✅ Success',
          totalClosed > 1 ? `${totalClosed} tasks completed` : 'Task completed successfully'
        );
        await fetchTaskDetails();
      }
    } catch (error) {
      setLocalActivities(prev => {
        const last = prev[0];
        return prev.filter(a => a !== last);
      });
      Alert.alert('Error', 'Failed to complete task');
    } finally {
      setStartingTask(false);
      setShowRelatedTasksSelector(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!taskDetails || taskDetails.status !== 'in_progress') {
      return;
    }

    const isFollowupTask =
      taskDetails?.followup_task_form_id !== null &&
      taskDetails?.followup_task_form_id !== undefined;

    const actionLabel = isFollowupTask ? 'Followup_Completed' : 'Completed';
    const localActivity: ActivityLog = {
      id: Date.now(),
      action: actionLabel,
      action_by: { name: 'You' },
      created_at: new Date().toISOString(),
    };
    setLocalActivities([localActivity, ...localActivities]);

    try {
      setStartingTask(true);

      // Check for related tasks before completing so the user can choose which to close
      const previewResponse = await Api.get(`/tasks/${taskId}/related_tasks/`);
      const relatedTasks = (previewResponse as any)?.data?.tasks || [];

      if (relatedTasks.length > 0) {
        setShowRelatedTasksSelector(true);
        return;
      }

      await completeTaskWithSelectedIds([]);
    } catch (error) {
      setLocalActivities(prev => prev.filter(a => a.id !== localActivity.id));
      Alert.alert('Error', 'Failed to load related tasks');
      setStartingTask(false);
    }
  };

  const handleTaskTitlePress = () => {

    // Followup task form is Task.form; fall back to assigned_form_id or route param
    const actualFormId = taskDetails?.form ?? taskDetails?.assigned_form_id ?? (formId ? Number(formId) : undefined);

    if (!actualFormId) {
      Alert.alert('Error', 'No form is associated with this task');
      return;
    }

    setFollowupFormId(actualFormId.toString());
    setShowFollowupFormModal(true);
  };

  const handleFollowupFormClose = () => {
    setShowFollowupFormModal(false);
    
    // For regular tasks, mark as completed after form submission
    if (isRegularTask) {
      handleCompleteTask();
      return;
    }
    
    checkAndOpenTaskCloseQuestions();
  };

  const handleTaskCloseQuestionsComplete = () => {
    setShowTaskCloseQuestionsModal(false);

    InteractionManager.runAfterInteractions(() => {
      router.replace(resolveReturnRoute());
    });
  };

  const checkAndOpenTaskCloseQuestions = async () => {
    try {
      const response = await Api.get<any>(`/form/task-close-questions/${taskId}/`);
      const questions = response.data?.questions || response.data || [];
      
      if (Array.isArray(questions) && questions.length > 0) {
        setShowTaskCloseQuestionsModal(true);
      } else {
        router.replace(resolveReturnRoute());
      }
    } catch (error) {
      router.replace(resolveReturnRoute());
    }
  };

  const handleOpenTaskCloseQuestions = () => {
    setShowTaskCloseQuestionsModal(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (!taskDetails) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['top']}>
        <Text style={styles.errorText}>Task not found</Text>
        <Text style={styles.debugText}>Task ID: {taskId}</Text>
        <Text style={styles.debugText}>Loading: {loading ? 'true' : 'false'}</Text>
      </SafeAreaView>
    );
  }

  const statusDisplay = getStatusDisplay(taskDetails.status);
  const headerDescription = (taskDetails.description || '')
    .replace(/\[REOPENED:\s*[^\]]*\]/g, '')
    .trim();
  const allActivities = [...localActivities, ...taskDetails.activity_logs];
  const assigneeLabel =
    Array.isArray(taskDetails.assignee_names) && taskDetails.assignee_names.length > 0
      ? taskDetails.assignee_names
          .map((a) => (a?.type === 'group' ? `Group: ${a.name}` : a?.name))
          .filter(Boolean)
          .join(', ')
      : null;

  const hasFollowupCreated = taskDetails.activity_logs.some(log => log.action === 'Followup_Created');
  const isMobileEndFollowup = hasFollowupCreated && !taskDetails.form && taskDetails.assigned_form_id;
  const isRegularTask = !taskDetails.followup_task_form_id && !!taskDetails.form;

  const shouldShowCompleteButton = taskDetails.status === 'in_progress' && ((isMobileEndFollowup && !showTaskCloseTag) || isRegularTask);
  const showStartButton = taskDetails.status === 'not_started';
  const showDisabledInProgress = taskDetails.status === 'in_progress' && !shouldShowCompleteButton;
  const shouldShowButton = showStartButton || shouldShowCompleteButton || showDisabledInProgress;
  const buttonText = showStartButton ? 'Start' :
                    shouldShowCompleteButton ? 'Complete' : 'In Progress';
  const buttonAction = showStartButton ? handleStartTask :
                      shouldShowCompleteButton ? (isRegularTask ? handleTaskTitlePress : handleShowTaskCloseTag) : () => {};
  const isButtonDisabled = startingTask || (!showStartButton && !shouldShowCompleteButton);

  const shouldShowTaskActionSection = (taskDetails.status !== 'not_started' && !!taskDetails.assigned_form_id && !isMobileEndFollowup);

  const resolveTaskFormType = (task: TaskDetails | null): string | undefined => {
    if (!task) return undefined;
    const raw =
      (task as any).form_type ||
      (task as any).assigned_form_type ||
      (task as any).followup_task_form_id?.form_type ||
      (task as any).form?.form_type ||
      (task as any).form_details?.form_type ||
      "";
    const normalized = String(raw).toLowerCase();
    if (!normalized) return undefined;
    if (normalized.includes("audit")) return "audit";
    if (normalized.includes("standard")) return "standard";
    if (normalized.includes("todo")) return "todo";
    return normalized;
  };

  const completedActivityIndex = allActivities.findIndex(
    log => (log.action || '').toLowerCase() === 'followup_completed'
  );
  const targetActivityIndex = completedActivityIndex >= 0 ? completedActivityIndex : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['top']}>
    <ScrollView style={styles.container}>
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
          <Text style={styles.backButtonText}>{isViewOnly ? 'Back to Forms' : 'Back to Todo'}</Text>
        </TouchableOpacity>
        {!isViewOnly && (
          <TouchableOpacity style={styles.shareButton} onPress={() => setShowShareModal(true)}>
            <MaterialIcons name="share" size={22} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Header Section - Box Style */}
      <View style={styles.boxContainer}>
        <View style={styles.header}>
          {taskDetails.parent_question && (
            <Text style={styles.parentQuestion}>{taskDetails.parent_question}</Text>
          )}

          <View style={styles.taskInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.taskTitle}>{taskDetails.task_name}</Text>
            </View>
            {headerDescription ? (
              <Text style={styles.taskDescription}>{headerDescription}</Text>
            ) : null}
            <Text style={styles.mainFormText}>Main Form : {mainFormTitle || '-'}</Text>
            <Text style={styles.mainFormText}>Location : {mainFormLocation || '-'}</Text>
          </View>

          <View style={styles.dateContainer}>
            <View style={styles.dateRow}>
              <View style={styles.dateTexts}>
                <Text style={styles.dateText}>
                  Start: {formatDate(taskDetails.start_date)}
                </Text>
                <Text style={styles.dateText}>
                  End: {formatDate(taskDetails.end_date)}
                </Text>
              </View>
              {shouldShowButton && !isViewOnly && (
                  <TouchableOpacity
                    style={[styles.startButton, isButtonDisabled && styles.startButtonDisabled]}
                    onPress={buttonAction}
                    disabled={isButtonDisabled}
                  >
                  <Text style={styles.startButtonText}>
                    {startingTask ? (shouldShowCompleteButton ? 'Completing...' : 'Starting...') : buttonText}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Status:</Text>
              <StatusBadge status={taskDetails.status} style={styles.statusBadge} />
              {taskDetails.is_auto_closed ? (
                <View style={{ backgroundColor: '#FEE2E2', marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '600' }}>Auto-Closed</Text>
                </View>
              ) : null}
            </View>
          </View>


        </View>
      </View>

      {/* Activity Feed - Box Style */}
      <View style={styles.boxContainer}>
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Activity Feed</Text>
          <View style={styles.activityList}>
            {allActivities.map((activity, index) => (
              <View key={activity.id} style={styles.activityItem}>
                <Ionicons
                  name={getActivityIcon(activity.action)}
                  size={24}
                  color={getActivityColor(activity.action)}
                  style={styles.activityIcon}
                />
                <View style={styles.activityContent}>
                  <View
                    style={[
                      styles.activityMessageCard,
                      { backgroundColor: getActivityBgColor(activity.action) }
                    ]}
                  >
                    <Text style={styles.activityMessage}>
                      {formatActivityMessage(activity, taskDetails.description, taskDetails.reopened_remarks)}
                    </Text>
                    {assigneeLabel && String(activity.action || '').toLowerCase() === 'followup_created' ? (
                      <Text style={styles.activitySubtext}>Shared with: {assigneeLabel}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.activityTime}>
                    {new Date(activity.created_at).toLocaleString()}
                  </Text>

                  {!isViewOnly && index === targetActivityIndex && showTaskCloseTag && isMobileEndFollowup ? (
                    <TouchableOpacity style={styles.taskFormButton} onPress={handleOpenTaskCloseQuestions}>
                      <Ionicons name="checkbox" size={24} color="#007AFF" style={styles.taskFormIcon} />
                      <View style={styles.taskFormContent}>
                        <Text style={styles.taskFormTitle}>You have task close questions only</Text>
                        <Text style={styles.taskFormSubtitle}>Click to answer task close questions</Text>
                      </View>
                      <View style={styles.buttonArrow}>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                      </View>
                    </TouchableOpacity>
                  ) : null}

                  {!isViewOnly && index === targetActivityIndex && shouldShowTaskActionSection && !showTaskCloseTag ? (
                    taskDetails.assigned_form_id ? (
                      <TouchableOpacity style={styles.taskFormButton} onPress={handleTaskTitlePress}>
                        <Ionicons name="document-text" size={24} color="#007AFF" style={styles.taskFormIcon} />
                        <View style={styles.taskFormContent}>
                          <Text style={styles.taskFormTitle}>{taskDetails.task_name}</Text>
                          <Text style={styles.taskFormSubtitle}>Click to open task form</Text>
                        </View>
                        <View style={styles.buttonArrow}>
                          <Ionicons name="chevron-forward" size={20} color="#666" />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.taskFormButton} onPress={handleOpenTaskCloseQuestions}>
                        <Ionicons name="checkbox" size={24} color="#007AFF" style={styles.taskFormIcon} />
                        <View style={styles.taskFormContent}>
                          <Text style={styles.taskFormTitle}>You have task close questions only</Text>
                          <Text style={styles.taskFormSubtitle}>Click to answer task close questions</Text>
                        </View>
                        <View style={styles.buttonArrow}>
                          <Ionicons name="chevron-forward" size={20} color="#666" />
                        </View>
                      </TouchableOpacity>
                    )
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Modal: Followup Task Form */}
      <Modal
        visible={showFollowupFormModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFollowupFormModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalBackButton} 
              onPress={() => setShowFollowupFormModal(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Task Form</Text>
            <View style={{ width: 40 }} />
          </View>
          
          {/* Form Content */}
          <View style={styles.modalContent}>
            {followupFormId && (
              <FollowupFormModal
                key={`followup-${followupFormId}-${taskId}`}
                formId={followupFormId}
                taskId={taskId}
                formType={resolveTaskFormType(taskDetails)}
                sourceScreen="task-summary"
                onClose={handleFollowupFormClose}
                onNavigateToTaskClose={handleNavigateToTaskCloseCallback}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal: Task Close Questions */}
      <Modal
        visible={showTaskCloseQuestionsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleTaskCloseQuestionsComplete}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          {/* Modal Header - No back/close buttons as task close questions must be completed */}
          <View style={styles.modalHeader}>
            <View style={{ width: 40 }} />
            <Text style={styles.modalTitle}>Task Close Questions</Text>
            <View style={{ width: 40 }} />
          </View>
          
          {/* Task Close Questions Content */}
          <View style={styles.modalContent}>
            <TaskCloseQuestionsModal 
              taskId={taskId}
              onClose={handleTaskCloseQuestionsComplete}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Related Tasks Selector */}
      <RelatedTasksSelector
        visible={showRelatedTasksSelector}
        taskId={taskId}
        onClose={() => {
          setShowRelatedTasksSelector(false);
          setStartingTask(false);
          completeTaskWithSelectedIds([]);
        }}
        onConfirm={(selectedIds) => {
          setShowRelatedTasksSelector(false);
          completeTaskWithSelectedIds(selectedIds);
        }}
      />

      {/* Modal: Share Task */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.shareOverlay}>
          <View style={styles.shareModal}>
            <View style={styles.shareHeader}>
              <Text style={styles.shareTitle}>Share Task</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)} style={styles.shareCloseButton}>
                <MaterialIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.shareTabs}>
              <TouchableOpacity
                style={[styles.shareTab, shareActiveTab === 'users' && styles.shareTabActive]}
                onPress={() => setShareActiveTab('users')}
              >
                <Text style={[styles.shareTabText, shareActiveTab === 'users' && styles.shareTabTextActive]}>
                  Users ({shareSelectedUsers.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shareTab, shareActiveTab === 'groups' && styles.shareTabActive]}
                onPress={() => setShareActiveTab('groups')}
              >
                <Text style={[styles.shareTabText, shareActiveTab === 'groups' && styles.shareTabTextActive]}>
                  Groups ({shareSelectedGroups.length})
                </Text>
              </TouchableOpacity>
            </View>

            {shareActiveTab === 'users' ? (
              <>
                <TextInput
                  style={styles.shareSearch}
                  placeholder="Search users..."
                  value={shareUserSearch}
                  onChangeText={setShareUserSearch}
                />
                {shareLoadingUsers ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <ScrollView style={styles.shareList}>
                    {shareUsers
                      .filter(u => {
                        const name = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
                        const email = (u.email || '').toLowerCase();
                        const query = shareUserSearch.toLowerCase();
                        return !query || name.includes(query) || email.includes(query);
                      })
                      .map(u => {
                        const label = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || u.email || 'Unknown';
                        const selected = shareSelectedUsers.includes(u.id);
                        return (
                          <TouchableOpacity
                            key={`user-${u.id}`}
                            style={styles.shareItem}
                            onPress={() => toggleShareUser(u.id)}
                          >
                            <Text style={styles.shareItemText}>{label}</Text>
                            {selected ? <MaterialIcons name="check" size={18} color="#007AFF" /> : null}
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                )}
              </>
            ) : (
              <>
                <TextInput
                  style={styles.shareSearch}
                  placeholder="Search groups..."
                  value={shareGroupSearch}
                  onChangeText={setShareGroupSearch}
                />
                {shareLoadingGroups ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <ScrollView style={styles.shareList}>
                    {shareGroups
                      .filter(g => {
                        const query = shareGroupSearch.toLowerCase();
                        return !query || (g.name || '').toLowerCase().includes(query);
                      })
                      .map(g => {
                        const selected = shareSelectedGroups.includes(g.id);
                        return (
                          <TouchableOpacity
                            key={`group-${g.id}`}
                            style={styles.shareItem}
                            onPress={() => toggleShareGroup(g.id)}
                          >
                            <Text style={styles.shareItemText}>{g.name || 'Group'}</Text>
                            {selected ? <MaterialIcons name="check" size={18} color="#007AFF" /> : null}
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                )}
              </>
            )}

            <View style={styles.shareFooter}>
              <TouchableOpacity
                style={[styles.shareActionButton, shareSubmitting && styles.shareActionDisabled]}
                onPress={handleShareTask}
                disabled={shareSubmitting}
              >
                <Text style={styles.shareActionText}>{shareSubmitting ? 'Sharing...' : 'Share'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareCancelButton}
                onPress={() => setShowShareModal(false)}
              >
                <Text style={styles.shareActionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
};

const formatActivityMessage = (
  log: ActivityLog,
  taskDescription?: string,
  reopenedRemarks?: string | null
): string => {
  const userName = log.action_by?.name || 'System';
  const action = log.action || '';

  // Handle case-insensitive matching
  switch (action.toLowerCase()) {
    case 'followup_created':
      return `${userName} shared this followup task`;
    case 'followup_started':
    case 'started':
      return `${userName} Started this task`;
    case 'followup_completed':
    case 'completed':
      return `${userName} Completed this task`;
    case 'auto_closed_related_task':
      return `${userName} Auto-closed this related task`;
    case 'followup_reopened':
      // Extract reopen remarks from description if available
      let remarks = '';
      if (reopenedRemarks && String(reopenedRemarks).trim()) {
        remarks = ` - Reason: ${String(reopenedRemarks).trim()}`;
      } else if (taskDescription) {
        const reopenMatch = taskDescription.match(/\[REOPENED:\s*([^\]]*)\]/);
        if (reopenMatch && reopenMatch[1]) {
          remarks = ` - Reason: ${reopenMatch[1].trim()}`;
        }
      }
      return `${userName} Reopened this task${remarks}`;
    case 'assigned':
      const targetName = log.action_to?.name;
      return targetName
        ? `${userName} shared this task with ${targetName}`
        : `${userName} shared this task`;
    default:
      return `${userName} performed action - ${log.action}`;
  }
};

const getActivityIcon = (action: string): string => {
  const normalizedAction = (action || '').toLowerCase();
  return {
    'followup_created': 'add-circle',
    'followup_started': 'play-circle',
    'started': 'play-circle',
    'followup_completed': 'checkmark-circle',
    'completed': 'checkmark-circle',
    'auto_closed_related_task': 'checkmark-done-circle',
    'followup_reopened': 'refresh-circle',
    'assigned': 'share',
  }[normalizedAction] || 'information-circle';
};

const getActivityColor = (action: string): string => {
  const normalizedAction = (action || '').toLowerCase();
  return {
    'followup_created': '#007AFF',
    'followup_started': '#34C759',
    'started': '#34C759',
    'followup_completed': '#34C759',
    'completed': '#34C759',
    'auto_closed_related_task': '#DC2626',
    'followup_reopened': '#FF9500',
    'assigned': '#007AFF',
  }[normalizedAction] || '#666';
};

const getActivityBgColor = (action: string): string => {
  const normalizedAction = (action || '').toLowerCase();
  return {
    'followup_created': '#E3F2FD',
    'followup_started': '#E8F5E8',
    'started': '#E8F5E8',
    'followup_completed': '#E8F5E8',
    'completed': '#E8F5E8',
    'auto_closed_related_task': '#FEE2E2',
    'followup_reopened': '#FFF3CD',
    'assigned': '#E3F2FD',
  }[normalizedAction] || '#F8F9FA';
};

const getMainFormSubmissionId = (taskDetails: TaskDetails | null): string | number | null => {
  if (!taskDetails) return null;
  const candidates = [
    (taskDetails as any).main_form_submission_id,
    (taskDetails as any).main_form_submission,
    (taskDetails as any).form_submission_id,
    (taskDetails as any).submission_id,
    (taskDetails as any).parent_submission_id,
    (taskDetails as any).parent_form_submission_id,
    (taskDetails as any).source_submission_id,
    (taskDetails as any).followup_task_form_submission_id,
    (taskDetails as any).followup_form_submission_id,
  ];

  for (const value of candidates) {
    if (value == null) continue;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
};

const getStatusDisplay = (status: string) => {
  const normalizedStatus = (status || '').toLowerCase().replace('_', '').replace(' ', '');
  return {
    'notstarted': { text: 'Not Started', color: '#FFA500', bgColor: '#FFF3CD' },
    'notassigned': { text: 'Not Started', color: '#FFA500', bgColor: '#FFF3CD' },
    'inprogress': { text: 'In Progress', color: '#007AFF', bgColor: '#E3F2FD' },
    'completed': { text: 'Completed', color: '#34C759', bgColor: '#E8F5E8' }
  }[normalizedStatus] || { text: status, color: '#666', bgColor: '#F5F5F5' };
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
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
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 5,
  },
  backButtonContainer: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 8,
  },
  shareButton: {
    padding: 8,
  },
  boxContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 8,
  },
  parentQuestion: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  taskInfo: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  taskDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 6,
    lineHeight: 20,
  },
  mainFormText: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 6,
  },
  dateContainer: {
    marginTop: 8,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateTexts: {
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  startButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 12,
  },
  startButtonDisabled: {
    backgroundColor: '#9acd32',
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginRight: 8,
  },
  statusBadge: {
    marginTop: 4,
  },
  activitySection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  activityList: {
    flexDirection: 'column',
    marginTop: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityMessageCard: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  activityMessage: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
  },
  activitySubtext: {
    marginTop: 6,
    fontSize: 12,
    color: '#6c757d',
  },
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 16,
  },
  shareModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    maxHeight: '85%',
  },
  shareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  shareCloseButton: {
    padding: 6,
  },
  shareTabs: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  shareTab: {
    flex: 1,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  shareTabActive: {
    borderBottomColor: '#007AFF',
  },
  shareTabText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  shareTabTextActive: {
    color: '#007AFF',
  },
  shareSearch: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    fontSize: 13,
  },
  shareList: {
    maxHeight: 320,
    marginBottom: 12,
  },
  shareItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  shareItemText: {
    fontSize: 13,
    color: '#1f2937',
  },
  shareFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  shareActionButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareCancelButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  shareActionDisabled: {
    opacity: 0.6,
  },
  activityTime: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  taskFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  taskFormIcon: {
    marginRight: 12,
  },
  taskFormContent: {
    flex: 1,
  },
  taskFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  taskFormSubtitle: {
    fontSize: 13,
    color: '#6c757d',
  },
  buttonArrow: {
    marginLeft: 8,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  modalBackButton: {
    padding: 8,
    minWidth: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
});

export default TaskSummaryScreen;
