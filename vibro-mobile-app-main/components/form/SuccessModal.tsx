import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import Toast from "react-native-toast-message";

type Props = {
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
  onShareToLeaders: () => void;
  onMakePdf: (emails: string[]) => Promise<void>;
  onViewSubmission: () => void;
  users: { email?: string }[];
  isGeneratingPdf: boolean;
  submittedData: any;
  showShareButtons?: boolean;
};

const SuccessModal: React.FC<Props> = ({
  visible,
  onClose,
  onShare,
  onShareToLeaders,
  onMakePdf,
  onViewSubmission,
  users,
  isGeneratingPdf,
  submittedData,
  showShareButtons = true,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [emails, setEmails] = useState("");

  const handleMakePdf = async () => {
    setIsLoading(true);
    try {
      const emailList = emails
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

      if (emailList.length === 0 && emails.trim()) {
        throw new Error("Please enter valid email addresses");
      }

      await onMakePdf(emailList);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: `Failed to generate or share PDF: ${error.message || "Unknown error"}`,
        position: "top",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.successIconContainer}>
              <Icon name="check-circle" size={24} color="white" />
            </View>
            <Text style={styles.successTitle}>Success</Text>
          </View>

          {/* Message */}
          <Text style={styles.successMessage}>
            Form submitted successfully!
          </Text>

          {/* Action Buttons */}
          {showShareButtons && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onShareToLeaders}
              >
                <Icon name="group" size={20} color="#6B46C1" />
                <Text style={styles.actionButtonText}>
                  Share to Location Leaders
                </Text>
                <Icon name="chevron-right" size={20} color="#6B46C1" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={onShare}
              >
                <Icon name="share" size={20} color="#6B46C1" />
                <Text style={styles.actionButtonText}>
                  Share to Users
                </Text>
                <Icon name="chevron-right" size={20} color="#6B46C1" />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.actionButton, isLoading && styles.disabledButton]}
            onPress={handleMakePdf}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#6B46C1" />
            ) : (
              <>
                <Icon name="description" size={20} color="#6B46C1" />
                <Text style={styles.actionButtonText}>
                  Make PDF
                </Text>
                <Icon name="chevron-right" size={20} color="#6B46C1" />
              </>
            )}
          </TouchableOpacity>

          {/* OK Button */}
          <TouchableOpacity
            style={styles.okButton}
            onPress={onClose}
          >
            <Text style={styles.okButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // bg-black/50
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: '80%', // w-4/5
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981', // bg-emerald-500
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  successTitle: {
    color: '#404040', // text-neutral-700
    fontSize: 18,
    fontWeight: '600',
  },
  successMessage: {
    color: '#737373', // text-neutral-500
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5', // bg-neutral-100
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#2196f3', // text-primary
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  okButton: {
    backgroundColor: '#2196f3', // bg-primary
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  okButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SuccessModal;
