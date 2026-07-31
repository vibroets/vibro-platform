// components/form/DropdownField.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
} from "react-native";
import { useSelector } from "react-redux";
import api from "../../../services";
import { DIVISION, LOCATION, SUBDIVISION, USERS_LIST, FORM } from "../../../services/constants";
import { matchLogicCondition } from "../../../services/matchLogicCondition";
import { textColors, typography } from "../../../styles/typography";
import { Question } from "../types/formTypes";
import FormField from "./FormField";
import FormFieldWrapper from "./FormFieldWrapper";
import TableField from "./TableField";

interface DropdownFieldProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  hasError?: boolean;
  isEditable?: boolean;
  validationErrors?: Record<string, boolean>;
  onFocus?: (fieldName: string) => void;
  setValue?: any;
  defaultExpanded?: boolean;
  forceExpanded?: boolean;
  container?: React.RefObject<import("../../../components/KeyboardAwareContainer").KeyboardAwareContainerRef>;
  plannerLocationId?: string;
  plannerLocationName?: string;
}

const URLS = {
  division: DIVISION,
  user: USERS_LIST,
  location: LOCATION,
  sub_division: SUBDIVISION,
} as const;

const DropdownField: React.FC<DropdownFieldProps> = ({
  question,
  control,
  errors,
  name,
  isCompleted,
  hasError,
  isEditable = true,
  validationErrors,
  onFocus,
  setValue,
  defaultExpanded,
  forceExpanded,
  container,
  plannerLocationId,
  plannerLocationName,
}) => {
  const user = useSelector((state: any) => state?.user);
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");



  const getVisibleLogicIndexes = (selectedValues: any[]): number[] => {
    if (!question?.logics?.length || !question?.options?.length) return [];
    const visibleLogicIndexes: number[] = [];
    const selectedOptionValues = selectedValues
      .filter((item) => item?.id)
      .map((item) => question.options.find((opt) => opt.id === item.id)?.option)
      .filter((value) => value !== undefined);

    // Check each logic condition
    question.logics.forEach((logic, index) => {
      const passes = selectedOptionValues.some((selectedValue) =>
        matchLogicCondition(selectedValue, logic.logic_value, logic.logic_type)
      );
      if (passes) visibleLogicIndexes.push(index);
    });

    return visibleLogicIndexes;
  };

  const filteredOptions = useMemo(() => {
    return options.filter((option) =>
      option.option.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, options]);

  const fetchOptions = async () => {
    // Skip dropdown functionality for title and description questions
    if (question?.question_type === 'title_and_description') {
      setOptions([]);
      return;
    }

    // If options are already provided on the question (e.g. from cached form structure), use them
    if (question.options && question.options.length > 0) {
      setOptions(question.options);
      return;
    }

    const cacheKey = `dropdown_opts_${question?.question_type}`;
    setLoading(true);
    try {
      const baseUrl = URLS[question?.question_type as keyof typeof URLS];
      if (baseUrl) {
        // For division, sub_division, and location: append organization ID if available
        const organizationId = (() => {
          if (user?.organizationId) return user.organizationId;
          const org = user?.organization;
          if (typeof org === "number") return org;
          if (org && typeof org === "object" && (org as any).id) return (org as any).id;
          if ((user as any)?.organization_id) return (user as any).organization_id;
          return null;
        })();

        const isOrgScopedEndpoint = ["division", "sub_division", "location"].includes(question?.question_type);

        // Debug: log user object and resolved organizationId
        try {
        } catch (e) {
        }

        const url = (isOrgScopedEndpoint && organizationId)
          ? `${baseUrl}${organizationId}/`
          : baseUrl;

        const response = await api.get(url);
        const opts = response?.data.map((item: any) => {
          let option = item.name ?? `Unnamed ${question?.question_type}`;
          option =
            question?.question_type === "user"
              ? `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim()
              : option;
          return { id: item.id, option };
        });
        setOptions(opts);
        // Cache options for offline usage
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(opts));
        } catch (cacheErr) {
        }
      } else {
        setOptions(question.options || []);
      }
    } catch (error: any) {
      // Try to load from cache when network/API fails
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setOptions(parsed);
          
        } else {
          setOptions(question.options || []);
        }
      } catch (cacheErr) {
        setOptions(question.options || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch options when none are loaded yet
    if (question?.question_type && options.length === 0 && !loading) {
      fetchOptions();
    }
  }, [question?.question_type, question?.question, question?.question_uuid, options.length, loading]);

  // Auto-set and lock location when plannerLocationId or plannerLocationName is provided
  const isLocationLocked = question?.question_type === "location" && (!!plannerLocationId || !!plannerLocationName);

  useEffect(() => {
    if (isLocationLocked && options.length > 0 && setValue) {
      let matchingOpt = null;
      let matchValue = null;

      // Strategy 1: Match by ID
      if (plannerLocationId) {
        const locationIdNum = Number(plannerLocationId);
        matchingOpt = options.find(o => o.id === locationIdNum);
        if (matchingOpt) matchValue = locationIdNum;
      }

      // Strategy 2: Match by name (case-insensitive) if ID didn't match
      if (!matchingOpt && plannerLocationName) {
        const lowerName = plannerLocationName.toLowerCase().trim();
        matchingOpt = options.find(o =>
          (o.option || "").toLowerCase().trim() === lowerName
        );
        if (matchingOpt) matchValue = matchingOpt.id;
      }

      // Strategy 3: Match by partial name (starts with or contains) if exact name didn't match
      if (!matchingOpt && plannerLocationName) {
        const lowerName = plannerLocationName.toLowerCase().trim();
        matchingOpt = options.find(o => {
          const optName = (o.option || "").toLowerCase().trim();
          return optName.startsWith(lowerName) || lowerName.startsWith(optName);
        });
        if (matchingOpt) matchValue = matchingOpt.id;
      }

      if (matchingOpt && matchValue !== null) {
        setValue(name, matchValue);
      }
    }
  }, [isLocationLocked, options, plannerLocationId, plannerLocationName, setValue, name]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2196f3" />
      </View>
    );
  }

  // Check if "Other" option exists in the options
  const hasOtherOption = question.options?.some(option => option.option?.toLowerCase() === 'other') || question.is_other;
  const shouldForceExpand =
    !!forceExpanded ||
    !!hasError ||
    !!errors?.[name] ||
    !!validationErrors?.[name] ||
    !!validationErrors?.[question.question_uuid];



  return (
    <FormFieldWrapper
      question={question}
      isCompleted={isCompleted}
      hasError={hasError}
      defaultExpanded={defaultExpanded}
      forceExpanded={shouldForceExpand}
    >
      {({ expanded }) => (
        <>
          <Controller
            control={control}
            name={name}
            rules={{
              required: question.is_required ? "This field is required" : false,
            }}
            render={({ field: { onChange, value } }) => {
              // When completed, use the answer from question.answers, otherwise use form value
              const currentValue = isCompleted 
                ? (question.answers?.answer_id || question.answers?.answer)
                : value;
              
              const visibleLogicIndexes: number[] = isCompleted
                ? getVisibleLogicIndexes(
                    question?.answers?.answer
                      ? [{ id: Number(question.answers?.answer_id) }]
                      : []
                  )
                : getVisibleLogicIndexes([{ id: currentValue }]);

              // Check if "Other" option is selected
              const otherOption = question.options?.find(opt => opt.option?.toLowerCase() === 'other');
              const isOtherSelected = otherOption ? currentValue === otherOption.id : false;

              // Get other text from a separate field or from question.answers.other_text
              const otherValue = isCompleted ? (question?.answers?.other_text || "") : "";

              const isDisabled = !isEditable || isCompleted || isLocationLocked;

              return (
                <>
                  <TouchableOpacity
                    style={[
                      styles.dropdownButton,
                      (errors[name] || hasError) && styles.errorInput,
                      isDisabled && styles.disabledButton,
                    ]}
                    disabled={isDisabled}
                    onPress={() => {
                      if (!isDisabled) {
                        setSearchQuery("");
                        if (Keyboard.isVisible()) {
                          Keyboard.dismiss();
                          setTimeout(() => setModalVisible(true), 150);
                        } else {
                          setModalVisible(true);
                        }
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownButtonText,
                        isDisabled && styles.disabledButtonText,
                      ]}
                    >
                      {(() => {
                        const displayOption = options.find((opt) => opt.id === currentValue);
                        if (displayOption) return displayOption.option;
                        if (currentValue && options.length > 0) {
                          const stringMatch = options.find(
                            (opt) => opt.option === currentValue || String(opt.id) === String(currentValue)
                          );
                          if (stringMatch) return stringMatch.option;
                        }
                        // If we have a stored value but no options (e.g., offline and never cached),
                        // show a generic indicator instead of appearing empty.
                        if (currentValue) {
                          return `Selected (ID: ${currentValue})`;
                        }
                        return question.question_hint || "Select an option";
                      })()}
                    </Text>
                    {!isDisabled && <MaterialIcons name="arrow-drop-down" size={24} color="#666" />}
                  </TouchableOpacity>

                  {/* Modal & Logic Questions */}
                  <Modal
                    animationType="fade"
                    transparent={true}
                    visible={modalVisible && !isDisabled}
                    onRequestClose={() => setModalVisible(false)}
                    statusBarTranslucent
                  >
                    <View style={styles.modalOverlay}>
                      <TouchableOpacity 
                        style={styles.modalBackdrop} 
                        activeOpacity={1} 
                        onPress={() => {
                          Keyboard.dismiss();
                          setModalVisible(false);
                        }}
                      />
                      <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                          <Text style={styles.modalTitle}>{question.question}</Text>
                          <TouchableOpacity onPress={() => setModalVisible(false)}>
                            <MaterialIcons name="close" size={24} color="#666" />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                          <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
                          <TextInput
                            style={styles.searchInput}
                            placeholder="Search..."
                            placeholderTextColor="#999"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus={false}
                          />
                          {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                              <MaterialIcons name="cancel" size={20} color="#999" style={styles.clearIcon} />
                            </TouchableOpacity>
                          )}
                        </View>

                        <FlatList
                          data={filteredOptions}
                          keyExtractor={(item) => item.id.toString()}
                          keyboardShouldPersistTaps="always"
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[
                                styles.optionItem,
                                value === item.id && styles.selectedOptionItem,
                              ]}
                              activeOpacity={0.7}
                              onPress={() => {
                                const selectionChanged = value !== item.id;

                                onChange(item.id);

                                // Defer keyboard dismissal to after interactions so it never blocks UI
                                InteractionManager.runAfterInteractions(() => Keyboard.dismiss());

                                // Whenever the selection actually changes, wipe ALL logic question data
                                // (including nested logic) so no stale data reappears for any option.
                                if (selectionChanged && setValue) {
                                  // Determine which logic questions will remain visible after this
                                  // selection so we don't unregister fields the user is editing.
                                  const visibleIndexes = getVisibleLogicIndexes([{ id: item.id }]);
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

                                  // Defer clearing hidden logic values so the dropdown selection feels instant.
                                  // The visibleQuestions update already hides them; this just wipes stale data.
                                  InteractionManager.runAfterInteractions(() => {
                                    const clearHiddenLogicQuestions = (logics: any[]) => {
                                      logics?.forEach((logic) => {
                                        logic.logic_questions?.forEach((lq: any) => {
                                          const key = (lq as any)?.uniqueId || lq.question_uuid;
                                          // Only clear values for questions that are becoming hidden.
                                          // Visible questions keep their answers; the backend removes
                                          // stale hidden answers on submission. Skip unregister to avoid
                                          // expensive re-registration cycles.
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
                                setModalVisible(false);
                              }}
                            >
                              <Text style={styles.optionText}>{item.option}</Text>
                              {value === item.id && (
                                <MaterialIcons name="check" size={20} color="#007AFF" />
                              )}
                            </TouchableOpacity>
                          )}
                          ItemSeparatorComponent={() => <View style={styles.separator} />}
                          ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                              <Text style={styles.emptyText}>No options found</Text>
                            </View>
                          }
                        />
                      </View>
                    </View>
                  </Modal>



                  {/* Other Text Input - shows when "Other" option is selected */}
                  {isOtherSelected && (
                    <View style={styles.otherTextareaContainer}>
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
                              // For completed forms, we might need to handle this differently
                              if (!isCompleted) {
                                // Update the main field to include the other text
                                // This is handled in the form submission logic
                              }
                            }}
                            editable={!isCompleted && isEditable}
                            autoCapitalize="sentences"
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                          />
                        )}
                      />
                      {errors[`${name}_other`] && (
                        <Text style={styles.errorTextSmall}>
                          {errors[`${name}_other`]?.message}
                        </Text>
                      )}
                    </View>
                  )}



                  {visibleLogicIndexes.length > 0 && (
                    <View>
                      {question.logics?.map(
                        (logic, logicIndex) =>
                          visibleLogicIndexes.includes(logicIndex) &&
                          logic?.logic_questions?.map((logicQuestion) => {
                            const logicQuestionKey = (logicQuestion as any).uniqueId || logicQuestion.question_uuid;
                            const logicQuestionError = !!errors[logicQuestionKey] || !!validationErrors?.[logicQuestionKey];
                            return logicQuestion.question_type === "table" ? (
                              <TableField
                                key={logicQuestionKey}
                                question={logicQuestion}
                                control={control}
                                errors={errors}
                                isCompleted={isCompleted}
                                isEditable={isEditable}
                              />
                            ) : (
                              <FormField
                                key={logicQuestionKey}
                                question={logicQuestion}
                                control={control}
                                errors={errors}
                                isCompleted={isCompleted}
                                isEditable={isEditable}
                                hasError={logicQuestionError}
                                validationErrors={validationErrors}
                                onFocus={onFocus}
                                setValue={setValue}
                                container={container}
                              />
                            );
                          })
                      )}
                    </View>
                  )}
                </>
              );
            }}
          />

          {(errors[name] || hasError) && (
            <Text style={styles.errorText}>
              {errors[name]?.message || "This field is required"}
            </Text>
          )}

          {isLocationLocked && (
            <View style={styles.lockedIndicator}>
              <MaterialIcons name="lock" size={14} color="#6B7280" />
              <Text style={styles.lockedText}>Locked by Planner</Text>
            </View>
          )}

        </>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { 
    ...typography.labelMedium, 
    marginBottom: 8 
  },
  required: { color: textColors.error },
  description: { 
    ...typography.bodyMedium, 
    color: textColors.secondary, 
    marginBottom: 12 
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    minHeight: 50,
  },
  errorInput: {
    borderColor: textColors.error,
    borderWidth: 2,
    backgroundColor: "#FFF0F0", // light red fill
  },
  disabledButton: {
    backgroundColor: "#F5F5F5", // Light gray background for view-only mode
    borderColor: "#E0E0E0",
  },
  dropdownButtonText: { 
    ...typography.labelLarge, 
    color: textColors.primary, 
    flex: 1 
  },
  disabledButtonText: {
    color: textColors.tertiary, // Gray text for view-only mode
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    maxHeight: "70%",
    width: "100%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: { 
    ...typography.titleSmall, 
    flex: 1 
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  clearIcon: { marginLeft: 8 },
  searchInput: { 
    ...typography.labelLarge, 
    flex: 1, 
    paddingVertical: 12, 
    color: textColors.primary 
  },
  optionItem: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedOptionItem: { backgroundColor: "#F0F7FF" },
  optionText: { 
    ...typography.labelMedium, 
    flex: 1 
  },
  separator: { height: 1, backgroundColor: "#eee", marginHorizontal: 16 },
  emptyContainer: { padding: 20, alignItems: "center", justifyContent: "center" },
  emptyText: { 
    ...typography.bodyMedium, 
    color: textColors.tertiary 
  },
  errorText: { 
    ...typography.bodySmall, 
    color: textColors.error, 
    marginTop: 6 
  },
  loadingContainer: {
    flex: 1,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    margin: 16,
  },
  otherInputContainer: {
    marginTop: 12,
  },
  otherInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    ...typography.labelLarge,
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
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 16,
    minHeight: 120,
    textAlignVertical: "top",
    color: textColors.primary,
  },
  inputError: {
    borderColor: textColors.error,
    backgroundColor: "#FFF0F0",
  },
  errorTextSmall: {
    ...typography.bodySmall,
    color: textColors.error,
    marginTop: 4,
    fontSize: 12,
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
  followUpContainer: {
    marginTop: 8,
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
  lockedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  lockedText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
});

export default DropdownField;
