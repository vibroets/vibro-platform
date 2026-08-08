// components/form/MultipleChoiceField.tsx
import { MaterialIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { Controller } from "react-hook-form";
import {
  Alert,
  FlatList,
  InteractionManager,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import api from "../../../services";
import { matchLogicCondition } from "../../../services/matchLogicCondition";
import { textColors, typography } from "../../../styles/typography";
import { Option, Question } from "../types/formTypes";
import Reference from "../utils/reference";
import FormField from "./FormField";
import FormFieldWrapper from "./FormFieldWrapper";
import TableField from "./TableField";

interface OptionItemProps {
  option: Option;
  selected: boolean;
  isCheckbox: boolean;
  isEditable: boolean;
  onPress: (option: Option) => void;
}

const OptionItem = memo(({ option, selected, isCheckbox, isEditable, onPress }: OptionItemProps) => {
  const iconName = isCheckbox
    ? selected
      ? "check-box"
      : "check-box-outline-blank"
    : selected
      ? "radio-button-checked"
      : "radio-button-unchecked";

  return (
    <TouchableOpacity
      disabled={!isEditable}
      style={[
        styles.optionButton,
        selected && styles.optionSelected,
      ]}
      onPress={() => onPress(option)}
      activeOpacity={0.7}
    >
      <View style={styles.optionContent}>
        <MaterialIcons
          name={iconName}
          size={24}
          color={selected ? "#007AFF" : "#666"}
        />
        <Text style={styles.optionText}>{option.option}</Text>
      </View>
    </TouchableOpacity>
  );
});

interface MultipleChoiceFieldProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  isEditable?: boolean;
  onFocus?: (fieldName: string) => void;
  getFieldRef?: (inputKey: string) => React.RefObject<View | null> | undefined;
  hasError?: boolean;
  allValues?: any;
  visibleQuestions?: Set<string>;
  getValues?: any;
  validationErrors?: Record<string, boolean>;
  focusedInputKey?: string | null;
  setValue?: any;
  onFollowupTaskCreated?: (questionId: string, taskData: any) => void;
  defaultExpanded?: boolean;
  forceExpanded?: boolean;
  // container?: React.RefObject<KeyboardAwareContainerRef>;
}

const MultipleChoiceField: React.FC<MultipleChoiceFieldProps> = ({
  question,
  control,
  errors,
  name,
  isCompleted,
  isEditable = true,
  hasError,
  onFocus,
  getFieldRef,
  visibleQuestions,
  getValues,
  validationErrors,
  focusedInputKey,
  setValue,
  onFollowupTaskCreated,
  defaultExpanded,
  forceExpanded,
  // container,
}) => {
  const isCheckbox = question.question_type === "checkboxes";
  const hasOtherOption = question.options?.some(option => option.option?.toLowerCase() === 'other') || question.is_other;
  const shouldForceExpand =
    !!forceExpanded ||
    !!hasError ||
    !!errors?.[name] ||
    !!validationErrors?.[name] ||
    !!validationErrors?.[question.question_uuid];

  // Follow-up task modal state
  const [followupModalVisible, setFollowupModalVisible] = useState(false);
  const [followupTitle, setFollowupTitle] = useState('');
  const [followupDescription, setFollowupDescription] = useState('');
  const [assignedFormId, setAssignedFormId] = useState<number | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<number[]>([]);
  const [assignedGroups, setAssignedGroups] = useState<number[]>([]);
  const [assignedLeaders, setAssignedLeaders] = useState<number[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<any[]>([]);

  const getVisibleLogicIndexes = (selectedValues: any[]): number[] => {
    if (!question?.logics?.length || !question?.options?.length) return [];

    const visibleLogicIndexes: number[] = [];
    const selectedOptionValues = selectedValues
      .filter((item) => item?.id)
      .map((item) => question.options.find((opt) => opt.id === item.id)?.option)
      .filter(Boolean);

    question.logics.forEach((logic, index) => {
      if (logic.logic_value !== undefined && logic.logic_value !== null) {
        const passes = selectedOptionValues.some((selectedValue) =>
          matchLogicCondition(selectedValue as string | number, logic.logic_value as string | number, logic.logic_type)
        );
        if (passes) visibleLogicIndexes.push(index);
      }
    });

    return visibleLogicIndexes;
  };

  // Fetch data for follow-up task modal
  const fetchFollowupData = async () => {
    try {
      const [formsRes, usersRes, groupsRes, leadersRes] = await Promise.all([
        api.get('/form/forms/'),
        api.get('/user/list/'),
        api.get('/user/groups/'),
        api.get('/user/location-leaders/')
      ]);

      setForms(formsRes.data || []);
      setUsers(usersRes.data || []);
      setGroups(groupsRes.data || []);
      setLeaders(leadersRes.data || []);
    } catch (error) {
    }
  };

  // Handle opening follow-up task modal
  const handleAddFollowupTask = (logicWithFollowUp: any) => {
    // Pre-fill with logic data if available
    setFollowupTitle(logicWithFollowUp?.follow_up?.title || '');
    setFollowupDescription(logicWithFollowUp?.follow_up?.description || '');
    fetchFollowupData();
    setFollowupModalVisible(true);
  };

  // Handle creating follow-up task
  const handleCreateFollowupTask = () => {
    if (!followupTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }
    if (!assignedFormId) {
      Alert.alert('Error', 'Please select an assigned form');
      return;
    }
    if (assignedUsers.length === 0 && assignedGroups.length === 0 && assignedLeaders.length === 0) {
      Alert.alert('Error', 'Please assign at least one user, group, or leader');
      return;
    }

    const taskData = {
      title: followupTitle.trim(),
      description: followupDescription.trim(),
      assign_form_id: assignedFormId,
      assign_user_ids: assignedUsers,
      assign_group_ids: assignedGroups,
      assign_leader_ids: assignedLeaders,
    };

    // Call the callback to notify parent component
    onFollowupTaskCreated?.(question.question_uuid, taskData);

    // Reset and close modal
    handleCloseFollowupModal();
  };

  const handleCloseFollowupModal = () => {
    setFollowupModalVisible(false);
    setFollowupTitle('');
    setFollowupDescription('');
    setAssignedFormId(null);
    setAssignedUsers([]);
    setAssignedGroups([]);
    setAssignedLeaders([]);
  };

  const toggleAssignment = (itemId: number, currentSelection: number[], setSelection: (ids: number[]) => void) => {
    if (currentSelection.includes(itemId)) {
      setSelection(currentSelection.filter(id => id !== itemId));
    } else {
      setSelection([...currentSelection, itemId]);
    }
  };

  return (
    <Controller
      control={control}
      name={name}
      rules={{
        validate: (value) =>
          !question.is_required ||
          (value && (isCheckbox ? value.length > 0 : !!value)) ||
          "Please select at least one option",
      }}
      render={({ field: { onChange, value } }) => {
        const currentValue = Array.isArray(value) ? value : [];

        // Refs for stable handleOptionPress callback — avoids recreating
        // the callback on every value change which would break OptionItem memo.
        const currentValueRef = useRef(currentValue);
        currentValueRef.current = currentValue;
        const onChangeRef = useRef(onChange);
        onChangeRef.current = onChange;

        // Check if "Other" option is selected
        const selectedOptions = currentValue.filter((item: any) => item?.id);
        const otherOption = question.options?.find(opt => opt.option?.toLowerCase() === 'other');
        const otherValueFromAnswers =
          (typeof (question as any)?.answers?.other_text === "string" &&
            (question as any).answers.other_text) ||
          (typeof (question as any)?.answers?.other_value === "string" &&
            (question as any).answers.other_value) ||
          (typeof (question as any)?.answer_data?.other_text === "string" &&
            (question as any).answer_data.other_text) ||
          (typeof (question as any)?.other_text === "string" &&
            (question as any).other_text) ||
          "";
        const otherValue =
          (currentValue.find((item: any) => item?.isOther)?.text || "") ||
          (isCompleted ? otherValueFromAnswers : otherValueFromAnswers);
        const isOtherSelected = otherOption
          ? selectedOptions.some((item: any) => item?.id === otherOption.id) ||
            (typeof otherValue === "string" && otherValue.trim().length > 0)
          : false;

        // Safety fallback: if we have custom other text, force selected state even if
        // `otherOption` metadata is missing or inconsistent.
        const isOtherSelectedWithFallback =
          (typeof otherValue === "string" && otherValue.trim().length > 0) ||
          isOtherSelected;

        const deriveSelectedFromAnswers = (): any[] => {
          const answers: any = (question as any)?.answers;
          const answerData: any = (question as any)?.answer_data;
          const rawCandidates: any[] = [];

          if (Array.isArray(answers)) rawCandidates.push(...answers);
          else if (answers) rawCandidates.push(answers);

          if (answerData) rawCandidates.push(answerData);
          if ((question as any)?.answer) rawCandidates.push({ answer: (question as any).answer });
          if ((question as any)?.submitted_value)
            rawCandidates.push({ answer: (question as any).submitted_value });

          const selected: any[] = [];
          const pushById = (id: number) => {
            const matched = question.options?.find((opt) => Number(opt.id) === id);
            if (matched) selected.push({ id: Number(matched.id), option: matched.option });
          };
          const pushByText = (text: string) => {
            const matched = question.options?.find(
              (opt) => String(opt.option || "").toLowerCase() === text.toLowerCase(),
            );
            if (matched) selected.push({ id: Number(matched.id), option: matched.option });
          };

          for (const raw of rawCandidates) {
            const answerId = raw?.answer_id;
            const answer = raw?.answer;
            if (answerId != null && !Number.isNaN(Number(answerId))) {
              pushById(Number(answerId));
              continue;
            }
            if (typeof answer === "number") {
              pushById(Number(answer));
              continue;
            }
            if (typeof answer === "string" && answer.trim()) {
              const parts = answer.includes("|")
                ? answer.split("|").map((v: string) => v.trim()).filter(Boolean)
                : [answer.trim()];
              for (const part of parts) {
                if (!Number.isNaN(Number(part))) pushById(Number(part));
                else pushByText(part);
              }
            }
          }

          return selected;
        };

        const logicSourceValue = useMemo(
          () =>
            currentValue.length > 0
              ? currentValue
              : isCompleted || !isEditable
                ? deriveSelectedFromAnswers()
                : currentValue,
          [currentValue, isCompleted, isEditable],
        );

        const visibleLogicIndexes = useMemo(
          () => getVisibleLogicIndexes(logicSourceValue),
          [logicSourceValue, question.logics, question.options],
        );

        const selectedIds = useMemo(
          () =>
            new Set(
              currentValue.map((item: any) => item?.id).filter(Boolean),
            ),
          [currentValue],
        );

        const handleOptionPress = useCallback((option: Option) => {
          if (!isEditable) return;

          const cv = currentValueRef.current;
          let newValue: any[];
          if (isCheckbox) {
            const exists = cv.some((item: any) => item?.id === option.id);
            newValue = exists
              ? cv.filter((item: any) => item?.id !== option.id)
              : [...cv, { id: option.id, option: option.option }];
          } else {
            newValue = [{ id: option.id, option: option.option }];
          }

          const selectionChanged =
            newValue.length !== cv.length ||
            !newValue.every((nv: any) =>
              cv.some((cv2: any) => cv2?.id === nv?.id),
            );

          // Update form value FIRST so the UI shows the selection immediately
          onChangeRef.current(newValue);

          // Defer keyboard dismissal to after interactions so it never blocks UI
          InteractionManager.runAfterInteractions(() => Keyboard.dismiss());

          if (selectionChanged && setValue) {
            // Determine which logic questions will remain visible after this
            // selection so we don't unregister fields the user is editing.
            const visibleIndexes = getVisibleLogicIndexes(newValue);
            const visibleKeys = new Set<string>();
            const collectVisibleKeys = (logics: any[]) => {
              logics?.forEach((logic: any, idx: number) => {
                if (visibleIndexes.includes(idx)) {
                  logic.logic_questions?.forEach((lq: any) => {
                    visibleKeys.add(
                      (lq as any)?.uniqueId || lq.question_uuid,
                    );
                  });
                }
              });
            };
            collectVisibleKeys(question.logics);

            // Defer clearing hidden logic values so the option click feels instant.
            // The visibleQuestions update already hides them; this just wipes stale data.
            InteractionManager.runAfterInteractions(() => {
              const clearHiddenLogicQuestions = (logics: any[]) => {
                logics?.forEach((logic) => {
                  logic.logic_questions?.forEach((lq: any) => {
                    const key = (lq as any)?.uniqueId || lq.question_uuid;
                    if (!visibleKeys.has(key)) {
                      const currentVal = control._formValues?.[key];
                      if (currentVal !== undefined) {
                        setValue(key, undefined, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
                      }
                      const otherKey = `${key}_other`;
                      const otherVal = control._formValues?.[otherKey];
                      if (otherVal !== undefined) {
                        setValue(otherKey, undefined, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
                      }
                      (lq as any).answers = undefined;
                    }
                    if (lq.logics?.length) {
                      clearHiddenLogicQuestions(lq.logics);
                    }
                  });
                });
              };
              clearHiddenLogicQuestions(question.logics);
            });
          }
        }, [isCheckbox, isEditable, setValue, question.logics, question.options, control]);

        const handleOtherTextChange = (text: string) => {
          if (!isEditable) return;

          // For completed forms, don't modify the value
          if (isCompleted) return;

          const newValue = currentValue.filter((item: any) => !item?.isOther);
          if (text.trim()) {
            newValue.push({ isOther: true, text: text.trim() });
          }
          onChange(newValue);
        };

        const getSelectedIdsFromAnswers = (): number[] => {
          const options = question.options || [];
          const rawCandidates: any[] = [];
          const answers: any = (question as any)?.answers;
          const answerData: any = (question as any)?.answer_data;

          if (answers) rawCandidates.push(answers);
          if (answerData) rawCandidates.push(answerData);
          if ((question as any)?.answer != null) rawCandidates.push({ answer: (question as any).answer });
          if ((question as any)?.submitted_value != null)
            rawCandidates.push({ answer: (question as any).submitted_value });
          if ((question as any)?.submitted_answer != null)
            rawCandidates.push({ answer: (question as any).submitted_answer });

          const ids: number[] = [];
          const pushById = (id: any) => {
            const num = Number(id);
            if (!Number.isNaN(num)) ids.push(num);
          };
          const pushByText = (text: string) => {
            const match = options.find(
              (opt) => String(opt.option || "").toLowerCase() === text.toLowerCase(),
            );
            if (match) ids.push(Number(match.id));
          };

          for (const raw of rawCandidates) {
            const answerId = raw?.answer_id ?? raw?.option_id;
            const answer = raw?.answer ?? raw?.value ?? raw?.text;

            if (answerId != null) {
              pushById(answerId);
              continue;
            }
            if (Array.isArray(answer)) {
              answer.forEach((item: any) => {
                if (item == null) return;
                if (typeof item === "object") {
                  if (item.id != null) pushById(item.id);
                  else if (item.option) pushByText(String(item.option));
                  else if (item.value) pushByText(String(item.value));
                  return;
                }
                if (!Number.isNaN(Number(item))) pushById(item);
                else pushByText(String(item));
              });
              continue;
            }
            if (typeof answer === "number") {
              pushById(answer);
              continue;
            }
            if (typeof answer === "string" && answer.trim()) {
              const parts = answer.includes("|")
                ? answer.split("|").map((v: string) => v.trim()).filter(Boolean)
                : answer.split(",").map((v: string) => v.trim()).filter(Boolean);
              for (const part of parts) {
                if (!Number.isNaN(Number(part))) pushById(part);
                else pushByText(part);
              }
            }
          }

          return Array.from(new Set(ids));
        };

        const isOptionSelected = (optionId: number | string) => {
          // Ensure "Other" is highlighted consistently in completed/sent mode
          // when there is non-empty custom Other text.
          if (
            isCompleted &&
            otherOption &&
            String(optionId) === String((otherOption as any).id)
          ) {
            return typeof otherValue === "string" && otherValue.trim().length > 0;
          }

          if (isCompleted) {
            const selectedIds = getSelectedIdsFromAnswers();
            return selectedIds.includes(Number(optionId));
          }
          return currentValue.some((item: any) => item?.id === optionId);
        };

        const hasErrorOnField = !!errors[name] || hasError;

        return (
          <FormFieldWrapper
            question={question}
            isCompleted={isCompleted}
            hasError={hasErrorOnField}
            focusedInputKey={focusedInputKey}
            defaultExpanded={defaultExpanded}
            forceExpanded={shouldForceExpand}
          >
            {({ expanded }) => (
              <>
                {/* Reference Media */}
                {expanded && (
                  <>
                    {(Array.isArray(question.reference_images) && question.reference_images.length > 0 ||
                     Array.isArray(question.reference_videos) && question.reference_videos.length > 0) && (
                      <Reference
                        mediaUrls={[
                          ...(question.reference_images || []).filter(Boolean),
                          ...(question.reference_videos || []).filter(Boolean),
                        ]}
                      />
                    )}
                  </>
                )}

                {/* Options */}
                {expanded && (
                  <View style={[styles.optionsContainer, hasErrorOnField && styles.optionsContainerError]}>
                    {question.options?.map((option) => (
                      <OptionItem
                        key={option.id}
                        option={option}
                        selected={selectedIds.has(option.id)}
                        isCheckbox={isCheckbox}
                        isEditable={isEditable}
                        onPress={handleOptionPress}
                      />
                    ))}

                    {/* Other Text Input - shows when "Other" option is selected */}
                    {isOtherSelected && (
                      <View ref={getFieldRef?.(`${name}_other`)} style={styles.otherTextareaContainer}>
                        <Controller
                          control={control}
                          name={`${name}_other`}
                          rules={{
                            required: isOtherSelected ? "Please specify" : false,
                          }}
                          render={({ field: { onChange, value } }) => (
                            <TextInput
                              style={[
                                styles.otherTextarea,
                                errors[`${name}_other`] && styles.inputError,
                              ]}
                              placeholder="Please specify..."
                              value={value || otherValue}
                              onChangeText={(text) => {
                                onChange(text);
                                handleOtherTextChange(text);
                              }}
                              onFocus={() => onFocus?.(`${name}_other`)}
                              editable={isEditable && !isCompleted}
                              autoCapitalize="sentences"
                              multiline
                              numberOfLines={4}
                              textAlignVertical="top"
                            />
                          )}
                        />
                        {errors[`${name}_other`] && (
                          <Text style={styles.errorTextSmall}>{errors[`${name}_other`].message}</Text>
                        )}
                      </View>
                    )}


                  </View>
                )}

                {/* Conditional Logic Questions */}
                {question.logics?.length > 0 && expanded && (
                  <View style={styles.logicContainer}>
                    {question.logics.map((logic, logicIndex) => {
                      const isLogicVisible = visibleLogicIndexes.includes(logicIndex);
                      const hasForciblyVisible = logic.logic_questions?.some((q) =>
                        visibleQuestions?.has((q as any).uniqueId || q.question_uuid)
                      );

                      if (!isLogicVisible && !hasForciblyVisible) return null;

                      return (
                        <View key={`logic-${logicIndex}`}>
                          {/* Logic Questions */}
                          {logic.logic_questions?.map((logicQuestion) => {
                            const logicQuestionKey =
                              (logicQuestion as any).uniqueId ||
                              logicQuestion.question_uuid;
                            const logicError =
                              !!errors[logicQuestionKey] ||
                              !!validationErrors?.[logicQuestionKey];

                            return logicQuestion.question_type === "table" ? (
                              <View
                                key={logicQuestionKey}
                                ref={getFieldRef?.(logicQuestionKey)}
                              >
                                <TableField
                                  question={logicQuestion}
                                  control={control}
                                  errors={errors}
                                  isCompleted={isCompleted}
                                  isEditable={isEditable}
                                />
                              </View>
                            ) : (
                              <View
                                key={logicQuestionKey}
                                ref={getFieldRef?.(logicQuestionKey)}
                              >
                                <FormField
                                  question={logicQuestion}
                                  control={control}
                                  errors={errors}
                                  isCompleted={isCompleted}
                                  isEditable={isEditable}
                                  onFocus={onFocus}
                                  hasError={logicError}
                                  validationErrors={validationErrors}
                                  focusedInputKey={focusedInputKey}
                                  setValue={setValue}
                                  // container={container}
                                />
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Sub Questions - show in view-only mode when expanded */}
                {!isEditable && expanded && question.sub_questions?.length > 0 && (
                  <View style={styles.logicContainer}>
                    {question.sub_questions.map((subQuestion) => {
                      const subQuestionKey =
                        (subQuestion as any).uniqueId ||
                        subQuestion.question_uuid;
                      const subQuestionError =
                        !!errors[subQuestionKey] ||
                        !!validationErrors?.[subQuestionKey];
                      return (
                        <View
                          key={subQuestionKey}
                          ref={getFieldRef?.(subQuestionKey)}
                        >
                          <FormField
                            question={subQuestion}
                            control={control}
                            errors={errors}
                            isCompleted={isCompleted}
                            isEditable={isEditable}
                            hasError={subQuestionError}
                            onFocus={onFocus}
                            focusedInputKey={focusedInputKey}
                            validationErrors={validationErrors}
                            setValue={setValue}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Error Message */}
                {hasErrorOnField && errors[name]?.message && (
                  <Text style={styles.errorText}>{errors[name].message}</Text>
                )}

                {/* Follow-up Task Modal */}
                <Modal
                  visible={followupModalVisible}
                  animationType="slide"
                  transparent={true}
                  onRequestClose={handleCloseFollowupModal}
                >
                  <View style={styles.followupModalOverlay}>
                    <View style={styles.followupModalContent}>
                      <View style={styles.followupModalHeader}>
                        <Text style={styles.followupModalTitle}>Add Followup Task</Text>
                        <TouchableOpacity onPress={handleCloseFollowupModal}>
                          <MaterialIcons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                      </View>

                      <ScrollView style={styles.followupModalBody} showsVerticalScrollIndicator={false}>
                        {/* Title */}
                        <View style={styles.followupFieldContainer}>
                          <Text style={styles.followupFieldLabel}>Task Title *</Text>
                          <TextInput
                            style={styles.followupTextInput}
                            value={followupTitle}
                            onChangeText={setFollowupTitle}
                            placeholder="Enter task title"
                            maxLength={255}
                          />
                        </View>

                        {/* Description */}
                        <View style={styles.followupFieldContainer}>
                          <Text style={styles.followupFieldLabel}>Description</Text>
                          <TextInput
                            style={[styles.followupTextInput, styles.followupTextArea]}
                            value={followupDescription}
                            onChangeText={setFollowupDescription}
                            placeholder="Enter task description"
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                          />
                        </View>

                        {/* Assigned Form */}
                        <View style={styles.followupFieldContainer}>
                          <Text style={styles.followupFieldLabel}>Assigned Form *</Text>
                          <Text style={styles.followupSelectedText}>
                            {assignedFormId ? forms.find(f => f.id === assignedFormId)?.title : 'Select a form'}
                          </Text>
                          <FlatList
                            data={forms}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                              <TouchableOpacity
                                style={[styles.followupOptionItem, assignedFormId === item.id && styles.followupSelectedOption]}
                                onPress={() => setAssignedFormId(item.id)}
                              >
                                <Text style={styles.followupOptionText}>{item.title}</Text>
                                <Text style={styles.followupOptionSubText}>{item.form_type}</Text>
                                {assignedFormId === item.id && (
                                  <MaterialIcons name="check" size={20} color="#007AFF" />
                                )}
                              </TouchableOpacity>
                            )}
                            style={styles.followupOptionsList}
                            showsVerticalScrollIndicator={false}
                          />
                        </View>

                        {/* Assigned Users */}
                        <View style={styles.followupFieldContainer}>
                          <Text style={styles.followupFieldLabel}>Assigned Users</Text>
                          <Text style={styles.followupSelectionCount}>
                            {assignedUsers.length} selected
                          </Text>
                          <FlatList
                            data={users}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                              <TouchableOpacity
                                style={[styles.followupOptionItem, assignedUsers.includes(item.id) && styles.followupSelectedOption]}
                                onPress={() => toggleAssignment(item.id, assignedUsers, setAssignedUsers)}
                              >
                                <Text style={styles.followupOptionText}>
                                  {item.first_name} {item.last_name}
                                </Text>
                                <Text style={styles.followupOptionSubText}>{item.username}</Text>
                                {assignedUsers.includes(item.id) && (
                                  <MaterialIcons name="check" size={20} color="#007AFF" />
                                )}
                              </TouchableOpacity>
                            )}
                            style={styles.followupOptionsList}
                            showsVerticalScrollIndicator={false}
                          />
                        </View>

                        {/* Assigned Groups */}
                        <View style={styles.followupFieldContainer}>
                          <Text style={styles.followupFieldLabel}>Assigned Groups</Text>
                          <Text style={styles.followupSelectionCount}>
                            {assignedGroups.length} selected
                          </Text>
                          <FlatList
                            data={groups}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                              <TouchableOpacity
                                style={[styles.followupOptionItem, assignedGroups.includes(item.id) && styles.followupSelectedOption]}
                                onPress={() => toggleAssignment(item.id, assignedGroups, setAssignedGroups)}
                              >
                                <Text style={styles.followupOptionText}>{item.name}</Text>
                                {assignedGroups.includes(item.id) && (
                                  <MaterialIcons name="check" size={20} color="#007AFF" />
                                )}
                              </TouchableOpacity>
                            )}
                            style={styles.followupOptionsList}
                            showsVerticalScrollIndicator={false}
                          />
                        </View>

                        {/* Assigned Location Leaders */}
                        <View style={styles.followupFieldContainer}>
                          <Text style={styles.followupFieldLabel}>Location Leaders</Text>
                          <Text style={styles.followupSelectionCount}>
                            {assignedLeaders.length} selected
                          </Text>
                          <FlatList
                            data={leaders}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                              <TouchableOpacity
                                style={[styles.followupOptionItem, assignedLeaders.includes(item.id) && styles.followupSelectedOption]}
                                onPress={() => toggleAssignment(item.id, assignedLeaders, setAssignedLeaders)}
                              >
                                <Text style={styles.followupOptionText}>
                                  {item.first_name} {item.last_name}
                                </Text>
                                <Text style={styles.followupOptionSubText}>{item.username}</Text>
                                {assignedLeaders.includes(item.id) && (
                                  <MaterialIcons name="check" size={20} color="#007AFF" />
                                )}
                              </TouchableOpacity>
                            )}
                            style={styles.followupOptionsList}
                            showsVerticalScrollIndicator={false}
                          />
                        </View>
                      </ScrollView>

                      {/* Footer Buttons */}
                      <View style={styles.followupModalFooter}>
                        <TouchableOpacity
                          style={[styles.followupButton, styles.followupCancelButton]}
                          onPress={handleCloseFollowupModal}
                        >
                          <Text style={styles.followupCancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.followupButton, styles.followupCreateButton]}
                          onPress={handleCreateFollowupTask}
                        >
                          <Text style={styles.followupCreateButtonText}>Create Task</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>
              </>
            )}
          </FormFieldWrapper>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  optionsContainer: {
    marginTop: 8,
  },
  optionsContainerError: {
    borderWidth: 1,
    borderColor: textColors.error,
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#FFF0F0",
  },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "#fff",
  },
  optionSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#F0F7FF",
    borderWidth: 2,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionText: {
    ...typography.labelLarge,
    marginLeft: 10,
    flex: 1,
    color: textColors.primary,
  },
  otherOptionContainer: {
    marginTop: 8,
  },
  otherOptionButton: {
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  otherInput: {
    ...typography.labelLarge,
    borderWidth: 1,
    borderColor: "#ddd",
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    color: textColors.primary,
  },
  otherTextareaContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingTop: 8,
  },
  otherTextarea: {
    ...typography.labelLarge,
    borderWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    textAlignVertical: "top",
    color: textColors.primary,
  },
  inputError: {
    borderColor: textColors.error,
    backgroundColor: "#FFF0F0",
  },
  errorText: {
    ...typography.bodySmall,
    color: textColors.error,
    marginTop: 8,
  },
  errorTextSmall: {
    ...typography.bodySmall,
    color: textColors.error,
    marginTop: 4,
    fontSize: 14,
  },
  logicContainer: {
    marginTop: 12,
  },
  followUpContainer: {
    marginTop: 8,
  },
  followUpIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0F7FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  followUpText: {
    ...typography.bodyMedium,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '600',
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  addTaskButtonText: {
    ...typography.labelMedium,
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
  followupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  followupModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '90%',
    width: '90%',
    maxWidth: 400,
  },
  followupModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  followupModalTitle: {
    ...typography.titleMedium,
    color: textColors.primary,
    fontWeight: '600',
  },
  followupModalBody: {
    padding: 16,
    maxHeight: 400,
  },
  followupFieldContainer: {
    marginBottom: 16,
  },
  followupFieldLabel: {
    ...typography.labelMedium,
    color: textColors.primary,
    marginBottom: 8,
    fontWeight: '600',
  },
  followupTextInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: textColors.primary,
  },
  followupTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  followupSelectedText: {
    ...typography.bodyMedium,
    color: textColors.secondary,
    marginBottom: 8,
  },
  followupSelectionCount: {
    ...typography.bodySmall,
    color: textColors.tertiary,
    marginBottom: 8,
  },
  followupOptionsList: {
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
  },
  followupOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  followupSelectedOption: {
    backgroundColor: '#F0F7FF',
  },
  followupOptionText: {
    ...typography.bodyMedium,
    color: textColors.primary,
    flex: 1,
  },
  followupOptionSubText: {
    ...typography.bodySmall,
    color: textColors.tertiary,
    marginRight: 8,
  },
  followupModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  followupButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  followupCancelButton: {
    backgroundColor: '#f5f5f5',
  },
  followupCreateButton: {
    backgroundColor: '#007AFF',
  },
  followupCancelButtonText: {
    ...typography.labelLarge,
    color: textColors.primary,
  },
  followupCreateButtonText: {
    ...typography.labelLarge,
    color: '#fff',
    fontWeight: '600',
  },
});

export default MultipleChoiceField;
