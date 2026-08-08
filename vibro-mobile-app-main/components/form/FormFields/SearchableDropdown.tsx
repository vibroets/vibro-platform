import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Controller } from "react-hook-form";
import {
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SearchableDropdownProps {
  control: any;
  name: string;
  label: string;
  options: { id: string | number; label: string }[];
  errors?: any;
  placeholder?: string;
  required?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  control,
  name,
  label,
  options,
  errors,
  placeholder = "Select an option",
  required = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    id: string | number;
    label: string;
  } | null>(null);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const getOptions = options.filter((option) =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredOptions(getOptions);
  }, [searchQuery, options]);

  const handleSelectItem = (item: { id: string | number; label: string }) => {
    setSelectedItem(item);
    setSearchQuery(item.label);
    setIsModalVisible(false);
  };

  const handleToggleModal = () => {
    setIsModalVisible(!isModalVisible);
    if (!isModalVisible) {
      setSearchQuery(selectedItem?.label || "");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <View style={styles.container}>
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>

          <TouchableOpacity
            style={[styles.inputContainer, errors?.[name] && styles.inputError]}
            onPress={handleToggleModal}
          >
            <Text
              style={[
                styles.inputText,
                !selectedItem && styles.placeholderText,
              ]}
              numberOfLines={1}
            >
              {selectedItem ? selectedItem.label : placeholder}
            </Text>
            <MaterialIcons
              name={isModalVisible ? "arrow-drop-up" : "arrow-drop-down"}
              size={24}
              color="#666"
            />
          </TouchableOpacity>

          <Modal
            visible={isModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setIsModalVisible(false)}
          >
            <KeyboardAvoidingView 
              style={styles.modalOverlay}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <TouchableOpacity 
                style={styles.modalBackdrop} 
                activeOpacity={1} 
                onPress={() => {
                  Keyboard.dismiss();
                  setIsModalVisible(false);
                }}
              />
              <View style={[styles.modalContent, { paddingBottom: insets.bottom || 16 }]}>
                <View style={styles.searchContainer}>
                  <TextInput
                    ref={inputRef}
                    style={styles.searchInput}
                    placeholder="Search..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  <TouchableOpacity
                    onPress={() => setIsModalVisible(false)}
                    style={styles.closeButton}
                  >
                    <MaterialIcons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={filteredOptions}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.optionItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        Keyboard.dismiss();
                        handleSelectItem(item);
                        onChange(item.id);
                      }}
                    >
                      <Text style={styles.optionText}>{item.label}</Text>
                      {selectedItem?.id === item.id && (
                        <MaterialIcons name="check" size={20} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => (
                    <View style={styles.separator} />
                  )}
                  keyboardShouldPersistTaps="always"
                />
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {errors?.[name] && (
            <Text style={styles.errorText}>{errors[name].message}</Text>
          )}
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  required: {
    color: "red",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  placeholderText: {
    color: "#999",
  },
  inputError: {
    borderColor: "red",
    backgroundColor: "#FFF0F0",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "60%",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  closeButton: {
    marginLeft: 10,
  },
  optionItem: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: "#eee",
    marginHorizontal: 16,
  },
  errorText: {
    color: "red",
    marginTop: 5,
    fontSize: 16,
  },
});

export default SearchableDropdown;
