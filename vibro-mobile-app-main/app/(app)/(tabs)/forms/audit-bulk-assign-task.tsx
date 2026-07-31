import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Logic, Question } from '../../../../components/form/types/formTypes';
import api from '../../../../services';
import { GROUPS_LIST, USERS_LIST } from '../../../../services/constants';
import { matchLogicCondition } from '../../../../services/matchLogicCondition';
import { SecureStoreService } from '../../../../services/secureStore';
import { textColors, typography } from '../../../../styles/typography';

interface ParentQuestionWithFollowUp {
  question_uuid: string;
  question: string;
  stageName: string;
  stageId: number;
}

const AuditBulkAssignTaskScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const formDataParam = params.formData as string;
  const bulkAssignKey = params.bulkAssignKey as string | undefined;

  const getFormValueForQuestion = (question: Question, formValues: any) => {
    if (!formValues || !question) return undefined;

    const uniqueId = (question as any)?.uniqueId;
    if (
      uniqueId &&
      Object.prototype.hasOwnProperty.call(formValues, uniqueId)
    ) {
      return formValues[uniqueId];
    }

    if (
      question.question_uuid &&
      Object.prototype.hasOwnProperty.call(formValues, question.question_uuid)
    ) {
      return formValues[question.question_uuid];
    }

    // Fallback for audit values keyed with prefixes (e.g. stage-0_<question_uuid>)
    const suffix = `_${question.question_uuid}`;
    const matchingKey = Object.keys(formValues).find(
      (key) => key === question.question_uuid || key.endsWith(suffix),
    );
    return matchingKey ? formValues[matchingKey] : undefined;
  };

  // Helper function to get visible logic indexes for a question based on current form values
  const getVisibleLogicIndexesForQuestion = (question: Question, formValues: any): number[] => {
    if (!question?.logics?.length) return [];

    const visibleLogicIndexes: number[] = [];
    const currentValue = getFormValueForQuestion(question, formValues);

    // Skip if no value selected for parent question
    if (currentValue === undefined || currentValue === null) return [];

    // Handle different question types to extract selected option values
    let selectedOptionValues: (string | number)[] = [];

    switch (question.question_type) {
      case "short_answer":
      case "long_answer":
        // For text fields, use the value directly
        if (currentValue && typeof currentValue === "string" && currentValue.trim()) {
          selectedOptionValues = [currentValue.trim()];
        }
        break;
      case "dropdown":
        // For dropdown, find the option by ID
        if (question.options?.length) {
          const selectedOption = question.options.find((opt: any) => opt.id === currentValue);
          if (selectedOption) {
            selectedOptionValues = [selectedOption.option];
          }
        }
        break;
      case "multiple_choice":
      case "checkboxes":
        // For multiple choice, extract option values from selected items
        if (Array.isArray(currentValue) && question.options?.length) {
          selectedOptionValues = currentValue
            .filter((item: any) => item?.id)
            .map((item: any) => question.options!.find((opt: any) => opt.id === item.id)?.option)
            .filter((value): value is string => value !== undefined);
        }
        break;
      case "audit":
        // For audit questions, value is stored as [{ id: optionId }] or just the optionId
        if (question.options?.length) {
          if (Array.isArray(currentValue)) {
            // Value is array like [{ id: optionId }]
            selectedOptionValues = currentValue
              .filter((item: any) => item?.id)
              .map((item: any) => question.options!.find((opt: any) => opt.id === item.id)?.option)
              .filter((value): value is string => value !== undefined);
          } else {
            // Value might be the option ID directly
            const selectedOption = question.options.find((opt: any) => opt.id === currentValue);
            if (selectedOption) {
              selectedOptionValues = [selectedOption.option];
            }
          }
        }
        break;
      case "linear_scale":
        // For linear scale, use the numeric value
        if (typeof currentValue === "object" && currentValue?.[question.question_uuid] !== undefined) {
          selectedOptionValues = [currentValue[question.question_uuid]];
        } else if (typeof currentValue === "number") {
          selectedOptionValues = [currentValue];
        }
        break;
      default:
        if (currentValue) {
          selectedOptionValues = [currentValue];
        }
    }

    // Check each logic condition
    question.logics.forEach((logic: Logic, index: number) => {
      const passes = selectedOptionValues.some((selectedValue) =>
        matchLogicCondition(
          selectedValue,
          logic.logic_value,
          logic.logic_type,
          logic.comparison
        )
      );
      if (passes) {
        visibleLogicIndexes.push(index);
      }
    });

    return visibleLogicIndexes;
  };

  // State for the page
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parentQuestions, setParentQuestions] = useState<ParentQuestionWithFollowUp[]>([]);
  const [selectedStages, setSelectedStages] = useState<Set<number>>(new Set());
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [formId, setFormId] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());

  // Assignee selection state
  const [showAssigneeSelection, setShowAssigneeSelection] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [hasSavedInSession, setHasSavedInSession] = useState(false);
  const [hasNonAssignedFollowUpOnly, setHasNonAssignedFollowUpOnly] = useState(false);

  const hasMeaningfulFollowUpTask = useCallback((followUp: Logic["follow_up"]) => {
    if (!followUp) return false;

    return Boolean(
      followUp.assign_form != null ||
        (typeof (followUp as any).assigned_form_title === "string" &&
          (followUp as any).assigned_form_title.trim() !== "") ||
        (typeof (followUp as any).assign_form_name === "string" &&
          (followUp as any).assign_form_name.trim() !== "") ||
        (typeof followUp.title === "string" && followUp.title.trim() !== "") ||
        (typeof followUp.description === "string" &&
          followUp.description.trim() !== "") ||
        (followUp.deadline != null && !Number.isNaN(Number(followUp.deadline))) ||
        (Array.isArray((followUp as any).assign_user_ids) &&
          (followUp as any).assign_user_ids.length > 0) ||
        (Array.isArray((followUp as any).assign_group_ids) &&
          (followUp as any).assign_group_ids.length > 0) ||
        (Array.isArray((followUp as any).assign_leader_ids) &&
          (followUp as any).assign_leader_ids.length > 0) ||
        (followUp as any).assign_to === "form_submitter" ||
        (Array.isArray(followUp.task_close_questions) &&
          followUp.task_close_questions.length > 0),
    );
  }, []);

  // Parse form data from navigation
  const parseFormData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setHasNonAssignedFollowUpOnly(false);

      let paramFormDataString: string | null = null;
      if (formDataParam) {
        try {
          paramFormDataString = decodeURIComponent(formDataParam);
        } catch (decodeError) {
          paramFormDataString = formDataParam;
        }
      }

      let secureStoreFormDataString: string | null = null;
      if (bulkAssignKey) {
        try {
          secureStoreFormDataString = await SecureStoreService.get(bulkAssignKey);
        } catch (storageError) {
        }
      }

      const tryParseFormData = (
        raw: string | null,
        source: 'param' | 'secureStore'
      ): { parsed: any; source: 'param' | 'secureStore' } | null => {
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || (!parsed.auditGroups && !parsed.auditInfo)) return null;
          return { parsed, source };
        } catch (parseError) {
          return null;
        }
      };

      const parsedFromSecure = tryParseFormData(secureStoreFormDataString, 'secureStore');
      const parsedFromParam = tryParseFormData(paramFormDataString, 'param');
      const parsedResult = parsedFromSecure || parsedFromParam;

      if (!parsedResult) {
        setError('Audit form data missing or invalid. Please go back and try again.');
        return;
      }


      const formData = parsedResult.parsed;
      const { auditGroups, auditInfo, formId, currentFormValues, visibleQuestions } = formData;

      setFormId(formId);

      // Restore saved selections (persists until form submission)
      const auditConfigKey = `audit_bulk_assignments_${formId}`;
      let restored = false;
      try {
        const savedConfigString = await SecureStoreService.get(auditConfigKey);
        if (savedConfigString) {
          const savedConfig = JSON.parse(savedConfigString);
          setSelectedStages(new Set(savedConfig.selectedStages || []));
          setSelectedQuestions(new Set(savedConfig.selectedQuestions || []));
          setSelectedUsers(new Set(savedConfig.selectedUsers || []));
          setSelectedGroups(new Set(savedConfig.selectedGroups || []));
          setShowAssigneeSelection(false);
          restored = true;
        }
      } catch (restoreError) {
      }

      if (!restored) {
        setSelectedStages(new Set());
        setSelectedQuestions(new Set());
        setSelectedUsers(new Set());
        setSelectedGroups(new Set());
        setShowAssigneeSelection(false);
      }

      // Collect questions from both audit_info and audit_groups
      const auditInfoQuestions = (auditInfo as any)?.questions || [];
      const auditGroupQuestions = (auditGroups || []).flatMap((group: any) => group?.questions || []);
      const allAuditQuestions = [...auditInfoQuestions, ...auditGroupQuestions];

      // Parse parent questions with follow-up tasks for audit forms
      let questionsWithFollowUp: ParentQuestionWithFollowUp[] = [];
      const collectAllQuestionsWithFollowUp = () => {
        const results: ParentQuestionWithFollowUp[] = [];
        allAuditQuestions.forEach((question: Question) => {
          let hasFollowUpTask = false;
          if (question.logics) {
            question.logics.forEach((logic: Logic) => {
              if (logic.follow_up) {
                hasFollowUpTask = true;
              }
              if (logic.logic_questions) {
                logic.logic_questions.forEach((logicQuestion: Question) => {
                  if (logicQuestion.logics) {
                    logicQuestion.logics.forEach((subLogic: Logic) => {
                      if (subLogic.follow_up) {
                        hasFollowUpTask = true;
                      }
                    });
                  }
                });
              }
            });
          }

          if (hasFollowUpTask) {
            const stageName = question.question_uuid?.includes('audit-info')
              ? 'Audit Information'
              : (auditGroups?.find((g: any) => g.questions?.some((q: any) => q.question_uuid === question.question_uuid))?.name || 'Unknown Group');

            results.push({
              question_uuid: question.question_uuid,
              question: question.question,
              stageName: stageName,
              stageId: question.question_uuid?.includes('audit-info')
                ? (auditInfo as any)?.id || 0
                : (auditGroups?.find((g: any) => g.questions?.some((q: any) => q.question_uuid === question.question_uuid))?.id || 0)
            });
          }
        });
        return results;
      };

      // If we have current form values, filter to only show questions that actually triggered follow-up tasks
      if (currentFormValues && visibleQuestions) {

        // Filter to questions that actually triggered follow-up tasks
        let hasTriggeredFollowUpLogic = false;
        let hasActionableTriggeredFollowUpTask = false;

        questionsWithFollowUp = allAuditQuestions
          .filter((question: Question) => {
            if (!question.logics?.length) return false;

            const visibleLogicIndexes = getVisibleLogicIndexesForQuestion(
              question,
              currentFormValues,
            );

            const triggeredLogics = question.logics.filter((logic: Logic, index: number) => {
              if (!logic.follow_up) return false;
              return visibleLogicIndexes.includes(index);
            });

            if (triggeredLogics.length === 0) return false;

            hasTriggeredFollowUpLogic = true;

            const actionableLogics = triggeredLogics.filter((logic: Logic) =>
              hasMeaningfulFollowUpTask(logic.follow_up),
            );

            if (actionableLogics.length > 0) {
              hasActionableTriggeredFollowUpTask = true;
            }

            return actionableLogics.length > 0;
          })
          .map((question: Question) => {
            const stageName = question.question_uuid?.includes('audit-info')
              ? 'Audit Information'
              : (auditGroups?.find((g: any) => g.questions?.some((q: any) => q.question_uuid === question.question_uuid))?.name || 'Unknown Group');

            return {
              question_uuid: question.question_uuid,
              question: question.question,
              stageName: stageName,
              stageId: question.question_uuid?.includes('audit-info')
                ? (auditInfo as any)?.id || 0
                : (auditGroups?.find((g: any) => g.questions?.some((q: any) => q.question_uuid === question.question_uuid))?.id || 0)
            };
          });

        setHasNonAssignedFollowUpOnly(hasTriggeredFollowUpLogic && !hasActionableTriggeredFollowUpTask);

      } else {
        // Backward compatibility: show all questions with follow-up logic configured
        questionsWithFollowUp = collectAllQuestionsWithFollowUp();
      }

      setParentQuestions(questionsWithFollowUp);
      const stageIdsWithQuestions = new Set(
        questionsWithFollowUp.map((q) => q.stageId)
      );
      setExpandedStages(stageIdsWithQuestions);
    } catch (error: any) {
      setError('Failed to load audit form data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [formDataParam, bulkAssignKey]);

  // Toggle stage selection
  const toggleStageSelection = useCallback((stageId: number) => {
    setSelectedStages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stageId)) {
        newSet.delete(stageId);
        // Also deselect all questions in this stage
        setSelectedQuestions(currentQuestions => {
          const newQuestions = new Set(currentQuestions);
          parentQuestions
            .filter(q => q.stageId === stageId)
            .forEach(q => newQuestions.delete(q.question_uuid));
          return newQuestions;
        });
      } else {
        newSet.add(stageId);
        // Also select all questions in this stage
        setSelectedQuestions(currentQuestions => {
          const newQuestions = new Set(currentQuestions);
          parentQuestions
            .filter(q => q.stageId === stageId)
            .forEach(q => newQuestions.add(q.question_uuid));
          return newQuestions;
        });
      }
      return newSet;
    });
  }, [parentQuestions]);

  const toggleStageExpansion = useCallback((stageId: number) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  }, []);

  // Toggle question selection
  const toggleQuestionSelection = useCallback((questionUuid: string, stageId: number) => {
    setSelectedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionUuid)) {
        newSet.delete(questionUuid);
        // If deselecting a question, also deselect the stage if all questions in stage are deselected
        const stageQuestions = parentQuestions.filter(q => q.stageId === stageId);
        const selectedStageQuestions = stageQuestions.filter(q => newSet.has(q.question_uuid));
        if (selectedStageQuestions.length === 0) {
          setSelectedStages(currentStages => {
            const newStages = new Set(currentStages);
            newStages.delete(stageId);
            return newStages;
          });
        }
      } else {
        newSet.add(questionUuid);
        // If selecting a question, also select the stage
        setSelectedStages(currentStages => {
          const newStages = new Set(currentStages);
          newStages.add(stageId);
          return newStages;
        });
      }
      return newSet;
    });
  }, [parentQuestions]);

  // Filter questions based on search
  const filteredQuestions = parentQuestions.filter(q =>
    q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.stageName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group questions by stage
  const questionsByStage = filteredQuestions.reduce((acc, question) => {
    if (!acc[question.stageId]) {
      acc[question.stageId] = {
        stageId: question.stageId,
        stageName: question.stageName,
        questions: []
      };
    }
    acc[question.stageId].questions.push(question);
    return acc;
  }, {} as Record<number, { stageId: number; stageName: string; questions: ParentQuestionWithFollowUp[] }>);

  // Fetch users and groups
  const fetchUsersAndGroups = useCallback(async () => {
    try {
      const usersResponse = await api.get(USERS_LIST);
      const usersData = usersResponse.data.map((user: any) => ({
        id: user.id,
        name: `${user.first_name} ${user.last_name}`.trim()
      }));
      setUsers(usersData);

      const groupsResponse = await api.get(GROUPS_LIST);
      const groupsData = groupsResponse.data.map((group: any) => ({
        id: group.id,
        name: group.name
      }));
      setGroups(groupsData);
    } catch (error) {
    }
  }, []);

  // Save assignment configurations temporarily
  const handleSaveAssignments = useCallback(async () => {
    if (selectedQuestions.size === 0 || (selectedUsers.size === 0 && selectedGroups.size === 0)) {
      alert('Please select questions and assignees');
      return;
    }

    if (!formId) {
      alert('Form ID not found');
      return;
    }

    setAssignLoading(true);

    try {
      // Prepare the assignment configuration
      const assignmentConfig = {
        selectedStages: Array.from(selectedStages),
        selectedQuestions: Array.from(selectedQuestions),
        selectedUsers: Array.from(selectedUsers),
        selectedGroups: Array.from(selectedGroups),
      };

      // Save to secure store with audit-specific key
      await SecureStoreService.set(`audit_bulk_assignments_${formId}`, JSON.stringify(assignmentConfig));

      setHasSavedInSession(true);
      alert('Audit assignments saved successfully');

      // Reset selections
      setSelectedStages(new Set());
      setSelectedQuestions(new Set());
      setSelectedUsers(new Set());
      setSelectedGroups(new Set());
      setShowAssigneeSelection(false);

      // Navigate back to form
      router.back();

    } catch (error: any) {
      alert('Failed to save assignments. Please try again.');
    } finally {
      setAssignLoading(false);
    }
  }, [selectedStages, selectedQuestions, selectedUsers, selectedGroups, formId]);

  useEffect(() => {
    parseFormData();
    fetchUsersAndGroups();
  }, [parseFormData, fetchUsersAndGroups]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading audit form data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={parseFormData}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Compact Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={20} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assign Follow-up Tasks</Text>
        <TouchableOpacity
          onPress={() => {
            setSelectedStages(new Set());
            setSelectedQuestions(new Set());
            setSelectedUsers(new Set());
            setSelectedGroups(new Set());
            setShowAssigneeSelection(false);
          }}
          style={styles.clearButton}
        >
          <MaterialIcons name="clear-all" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      {/* Compact Search */}
      {parentQuestions.length > 0 && (
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={16} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search questions..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content Area */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: selectedQuestions.size > 0 ? 140 : 16 }}>
        {Object.keys(questionsByStage).length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="assignment" size={36} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {hasNonAssignedFollowUpOnly ? 'No Follow-up Task' : 'No Questions with Follow-up Tasks'}
            </Text>
            <Text style={styles.emptyText}>
              {hasNonAssignedFollowUpOnly
                ? 'The selected option only enables conditional logic.'
                : 'This audit form has no follow-up tasks configured.'}
            </Text>
          </View>
        ) : (
          Object.values(questionsByStage).map((stageGroup) => (
            <View key={stageGroup.stageId} style={styles.stageContainer}>
              {/* Compact Stage Header */}
              <View style={styles.stageHeader}>
                <TouchableOpacity
                  style={styles.stageHeaderLeft}
                  onPress={() => toggleStageSelection(stageGroup.stageId)}
                >
                  <View style={[styles.checkbox, selectedStages.has(stageGroup.stageId) && styles.checkboxSelected]}>
                    {selectedStages.has(stageGroup.stageId) && (
                      <MaterialIcons name="check" size={14} color="white" />
                    )}
                  </View>
                  <Text style={styles.stageName} numberOfLines={1}>{stageGroup.stageName}</Text>
                  <View style={styles.stageCountBadge}>
                    <Text style={styles.stageCountText}>{stageGroup.questions.length}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleStageExpansion(stageGroup.stageId)}
                  style={styles.stageChevronButton}
                >
                  <MaterialIcons
                    name={expandedStages.has(stageGroup.stageId) ? "expand-less" : "expand-more"}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>

              {/* Questions - compact rows */}
              {expandedStages.has(stageGroup.stageId) && (
                <View style={styles.questionList}>
                  {stageGroup.questions.map((question) => {
                    const isSelected = selectedQuestions.has(question.question_uuid);
                    return (
                      <TouchableOpacity
                        key={question.question_uuid}
                        style={[styles.questionRow, isSelected && styles.questionRowSelected]}
                        onPress={() => toggleQuestionSelection(question.question_uuid, question.stageId)}
                        activeOpacity={0.6}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <MaterialIcons name="check" size={14} color="white" />}
                        </View>
                        <Text style={styles.questionText} numberOfLines={2}>{question.question}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Compact Bottom Assignee Bar */}
      {selectedQuestions.size > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarTop}>
            <Text style={styles.bottomBarCount}>{selectedQuestions.size} question{selectedQuestions.size > 1 ? 's' : ''} selected</Text>
            <TouchableOpacity
              style={styles.dropdownPill}
              onPress={() => setShowUserModal(true)}
            >
              <MaterialIcons name="person" size={14} color="#6B7280" />
              <Text style={styles.dropdownPillText} numberOfLines={1}>
                {selectedUsers.size > 0 ? `${selectedUsers.size} user${selectedUsers.size > 1 ? 's' : ''}` : 'Users'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownPill}
              onPress={() => setShowGroupModal(true)}
            >
              <MaterialIcons name="group" size={14} color="#6B7280" />
              <Text style={styles.dropdownPillText} numberOfLines={1}>
                {selectedGroups.size > 0 ? `${selectedGroups.size} group${selectedGroups.size > 1 ? 's' : ''}` : 'Groups'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.saveButton, (selectedUsers.size === 0 && selectedGroups.size === 0) && styles.saveButtonDisabled]}
            onPress={handleSaveAssignments}
            disabled={assignLoading || (selectedUsers.size === 0 && selectedGroups.size === 0)}
          >
            {assignLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Assignments</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* User Selection Modal - compact */}
      <Modal
        visible={showUserModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Users</Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <MaterialIcons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchRow}>
              <MaterialIcons name="search" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search users..."
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <FlatList
              data={users.filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()))}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedUsers.has(item.id);
                return (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedUsers(prev => {
                        const newSet = new Set(prev);
                        if (isSelected) newSet.delete(item.id);
                        else newSet.add(item.id);
                        return newSet;
                      });
                    }}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <MaterialIcons name="check" size={14} color="white" />}
                    </View>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={styles.modalEmpty}>No users found</Text>}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setShowUserModal(false)}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Group Selection Modal - compact */}
      <Modal
        visible={showGroupModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGroupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Groups</Text>
              <TouchableOpacity onPress={() => setShowGroupModal(false)}>
                <MaterialIcons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchRow}>
              <MaterialIcons name="search" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search groups..."
                value={groupSearchQuery}
                onChangeText={setGroupSearchQuery}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <FlatList
              data={groups.filter(g => g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedGroups.has(item.id);
                return (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedGroups(prev => {
                        const newSet = new Set(prev);
                        if (isSelected) newSet.delete(item.id);
                        else newSet.add(item.id);
                        return newSet;
                      });
                    }}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <MaterialIcons name="check" size={14} color="white" />}
                    </View>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={styles.modalEmpty}>No groups found</Text>}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setShowGroupModal(false)}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: textColors.primary,
  },
  clearButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: textColors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    fontSize: 14,
    color: textColors.secondary,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: textColors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: textColors.primary,
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: textColors.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  stageContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  stageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  stageChevronButton: {
    padding: 2,
  },
  stageName: {
    fontSize: 14,
    fontWeight: '600',
    color: textColors.primary,
    flex: 1,
  },
  stageCountBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  stageCountText: {
    fontSize: 11,
    color: '#4338CA',
    fontWeight: '700',
  },
  questionList: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 4,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  questionRowSelected: {
    backgroundColor: '#EEF6FF',
    borderColor: '#93C5FD',
  },
  questionText: {
    fontSize: 13,
    color: textColors.primary,
    flex: 1,
    lineHeight: 18,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 14,
  },
  bottomBarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  bottomBarCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  dropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  dropdownPillText: {
    fontSize: 12,
    color: '#374151',
  },
  saveButton: {
    backgroundColor: '#28A745',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '88%',
    maxWidth: 380,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: textColors.primary,
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: textColors.primary,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  modalItemText: {
    fontSize: 14,
    color: textColors.primary,
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 14,
  },
  modalEmpty: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 13,
    padding: 20,
  },
  modalDoneBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    margin: 14,
  },
  modalDoneText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});

export default AuditBulkAssignTaskScreen;
