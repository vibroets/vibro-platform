import api from "@/services";
import { DIVISION } from "@/services/constants";
import { matchLogicCondition } from "@/services/matchLogicCondition";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Controller } from "react-hook-form";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Question } from "../types/formTypes";
import FormField from "./FormField";
import FormFieldWrapper from "./FormFieldWrapper";
import TableField from "./TableField";

interface DivisionFieldProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  hasError?: boolean;
  isEditable?: boolean;
}

const DivisionField: React.FC<DivisionFieldProps> = ({
  question,
  control,
  errors,
  name,
  isCompleted,
  hasError,
  isEditable = true,
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
    setLoading(true);
    try {
      const organizationId = (() => {
        if (user?.organizationId) return user.organizationId;
        const org = user?.organization;
        if (typeof org === "number") return org;
        if (org && typeof org === "object" && (org as any).id) return (org as any).id;
        if ((user as any)?.organization_id) return (user as any).organization_id;
        return null;
      })();

      // Use organization-scoped endpoint if organizationId is available
      const url = organizationId
        ? `${DIVISION}${organizationId}/`
        : DIVISION;

      // console.log(`🌐 Calling API endpoint: ${url}`);
      const response = await api.get(url);
      const opts = response?.data.map((item: any) => {
        const option = item.name ?? `Unnamed division`;
        return { id: item.id, option };
      });
      setOptions(opts);
    } catch (error: any) {
      setOptions(question.options || []);
    } finally {
      setLoading(false);
    }
  };

  const hasFetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (question?.question_uuid && hasFetchedRef.current !== question?.question_uuid) {
      hasFetchedRef.current = question?.question_uuid;
      fetchOptions();
    }
  }, [question?.question_uuid]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2196f3" />
      </View>
    );
  }

  return (
    <FormFieldWrapper question={question} isCompleted={isCompleted}>
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

              const isDisabled = !isEditable || isCompleted;

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
                        setModalVisible(true);
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
                        return question.question_hint || "Select a division";
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
                  >
                    <View style={styles.modalOverlay}>
                      <TouchableOpacity 
                        style={styles.modalBackdrop} 
                        activeOpacity={1} 
                        onPress={() => setModalVisible(false)}
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
                            autoFocus={true}
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
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[
                                styles.optionItem,
                                value === item.id && styles.selectedOptionItem,
                              ]}
                              onPress={() => {
                                onChange(item.id);
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
                              <Text style={styles.emptyText}>No divisions found</Text>
                            </View>
                          }
                        />
                      </View>
                    </View>
                  </Modal>

                  {visibleLogicIndexes.length > 0 && (
                    <View>
                      {question.logics?.map(
                        (logic, logicIndex) =>
                          visibleLogicIndexes.includes(logicIndex) &&
                          logic?.logic_questions?.map((logicQuestion) => {
                            const logicQuestionKey =
                              (logicQuestion as any).uniqueId ||
                              logicQuestion.question_uuid;
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
                                hasError={hasError}
                              />
                            )
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
        </>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "bold", marginBottom: 8 },
  required: { color: "red" },
  description: { fontSize: 16, color: "#666", marginBottom: 12 },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    minHeight: 50,
  },
  errorInput: {
    borderColor: "red",
    borderWidth: 2,
    backgroundColor: "#FFF0F0", // light red fill
  },
  disabledButton: {
    backgroundColor: "#F5F5F5", // Light gray background for view-only mode
    borderColor: "#E0E0E0",
  },
  dropdownButtonText: { fontSize: 14, color: "#333", flex: 1 },
  disabledButtonText: {
    color: "#666", // Gray text for view-only mode
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
  modalTitle: { fontSize: 16, fontWeight: "bold", flex: 1 },
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
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 12, color: "#333" },
  optionItem: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedOptionItem: { backgroundColor: "#F0F7FF" },
  optionText: { fontSize: 14, flex: 1 },
  separator: { height: 1, backgroundColor: "#eee", marginHorizontal: 16 },
  emptyContainer: { padding: 20, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 16, color: "#999" },
  errorText: { color: "red", marginTop: 5, fontSize: 16 },
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
});

export default DivisionField;
