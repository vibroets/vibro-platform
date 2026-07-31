// components/LogicModal.tsx
import React from "react";
import { useForm } from "react-hook-form";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FormField from "../FormFields/FormField";

interface LogicModalProps {
  visible: boolean;
  title: string;
  questions: any[];
  control: any;
  errors: any;
  onSubmit: (data: any) => void;
  onClose: () => void;
}

const LogicModal: React.FC<LogicModalProps> = ({
  visible,
  title,
  questions,
  control,
  errors,
  onSubmit,
  onClose,
}) => {
  const { handleSubmit } = useForm();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{title}</Text>

          <ScrollView style={styles.modalContent}>
            {questions.map((question) => (
              <View key={question.id} style={styles.questionContainer}>
                <FormField
                  question={question}
                  control={control}
                  errors={errors}
                />
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit(onSubmit)}
            >
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  modalContent: {
    marginBottom: 15,
  },
  questionContainer: {
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 5,
    alignItems: "center",
  },
  submitButton: {
    backgroundColor: "#2196F3",
  },
  buttonText: {
    color: "#000",
  },
});

export default LogicModal;
