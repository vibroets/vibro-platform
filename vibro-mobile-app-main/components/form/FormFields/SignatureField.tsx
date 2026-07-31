import { networkService } from "@/services/networkService";
import { uploadToCloudinary } from "@/services/uploadToCloudinary";
import React, { useRef, useState } from "react";
import { Controller } from "react-hook-form";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import SignatureCanvas from "react-native-signature-canvas";
import { Question } from "../types/formTypes";
import Reference from "../utils/reference";
import FormFieldWrapper from "./FormFieldWrapper";

// Helper to extract public_id from a Cloudinary URL
const extractCloudinaryPublicId = (url: string) => {
  const parts = url.split("/");
  const lastPart = parts[parts.length - 1];
  const filename = lastPart.split(".")[0];
  const folderPath = parts.slice(6, parts.length - 1).join("/");
  return `${folderPath}/${filename}`;
};

// Stub for Cloudinary delete (replace with actual API call in production)
const deleteFromCloudinary = async (publicId: string, cloudName: string) => {
  await new Promise((res) => setTimeout(res, 1000)); // Simulate delay
};

interface CustomSignatureProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  isEditable?: boolean;
  hasError?: boolean;
}

const CustomSignature: React.FC<CustomSignatureProps> = ({
  control,
  name,
  question,
  errors,
  isCompleted,
  isEditable = true,
  hasError,
}) => {
  const [uploading, setUploading] = useState(false); // Upload progress state
  const [deleting, setDeleting] = useState(false); // Deletion progress state
  const [modalVisible, setModalVisible] = useState(false);
  const [tempSignature, setTempSignature] = useState<string | null>(null); // Temporary base64
  const sigRef = useRef<any>(null);
  const handleOK = (sig: string) => {
    setTempSignature(sig); // Store base64 temporarily
  };

  const handleEnd = () => {
    sigRef.current?.readSignature();
  };

  const handleSave = async (onChange: (value: string) => void) => {
    if (!tempSignature) {
      Alert.alert("Error", "No signature to save.");
      return;
    }

    try {
      const isOffline = networkService.isOffline();

      if (isOffline) {
        onChange(tempSignature);
        setModalVisible(false);
        setTempSignature(null);
        return;
      }

      setUploading(true);
      // Ensure base64 is clean (remove data URI prefix)
      const cleanBase64 = tempSignature.replace(/^data:image\/png;base64,/, "");
      const file = {
        uri: tempSignature, // Keep original URI for compatibility (data URI)
        base64: cleanBase64, // Add clean base64 for Cloudinary
        name: `signature_${Date.now()}.png`,
        type: "image/png",
      };

      // Upload to Cloudinary with retry logic
      let cloudinaryUrl: string | null = null;
      const maxRetries = 3;
      let attempt = 0;

      while (attempt < maxRetries && !cloudinaryUrl) {
        try {
          cloudinaryUrl = await uploadToCloudinary(
            file,
            "vibro_ets",
            "cdley8e7"
          );
        } catch (retryErr: any) {
          attempt++;
          if (attempt === maxRetries) {
            throw retryErr; // Rethrow after max retries
          }
          // Wait before retrying
          await new Promise((res) => setTimeout(res, 1000));
        }
      }

      if (!cloudinaryUrl) {
        throw new Error("Failed to upload signature after retries.");
      }

      onChange(cloudinaryUrl); // Update form value
      setModalVisible(false);
      setTempSignature(null); // Clear temp signature
    } catch (err: any) {
      Alert.alert(
        "Upload Failed",
        err?.message ||
          "Could not upload signature. Please check your network and try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setTempSignature(null);
    sigRef.current?.clearSignature();
  };

  const handleReset = async (onChange: (value: string) => void, currentValue: string) => {
    if (!currentValue) return;

    try {
      setDeleting(true);
      const publicId = extractCloudinaryPublicId(currentValue);
      await deleteFromCloudinary(publicId, "cdley8e7");

      setTempSignature(null);
      onChange(""); // Clear form value
    } catch (err: any) {
      Alert.alert(
        "Deletion Failed",
        err?.message || "Could not delete signature."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <FormFieldWrapper question={question} isCompleted={isCompleted} hasError={hasError}>
      {() => (
        <>
          {question?.reference_images?.length ||
          question?.reference_videos?.length ? (
            <Reference
              mediaUrls={[
                ...(question?.reference_images || []),
                ...(question?.reference_videos || []),
              ]}
            />
          ) : null}

          <Controller
            control={control}
            name={name}
            rules={{
              validate: (value: string) =>
                !question?.is_required ||
                (value && value.length > 0) ||
                "Signature is required",
            }}
            render={({ field: { onChange, value } }) => (
              <>
                {value ? (
                  <View style={styles.previewWrapper}>
                    <Image
                      source={{ uri: value }}
                      style={styles.signaturePreview}
                      resizeMode="contain"
                    />
                    <TouchableOpacity
                      onPress={() => handleReset(onChange, value)}
                      style={[
                        styles.button,
                        (!isEditable || uploading || deleting) &&
                          styles.disabledButton,
                      ]}
                      disabled={!isEditable || uploading || deleting}
                    >
                      {deleting ? (
                        <ActivityIndicator size="small" color="#FF3B30" />
                      ) : (
                        <Text style={styles.buttonText}>Reset</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setModalVisible(true);
                    }}
                    style={[
                      styles.addButton,
                      (errors[name] || hasError) && styles.addButtonError,
                      (!isEditable || uploading || deleting) &&
                        styles.disabledButton,
                    ]}
                    disabled={!isEditable || uploading || deleting}
                  >
                    <Text
                      style={[
                        styles.addButtonText,
                        (errors[name] || hasError) && styles.addButtonTextError,
                        (!isEditable || uploading || deleting) &&
                          styles.disabledText,
                      ]}
                    >
                      Add Signature
                    </Text>
                  </TouchableOpacity>
                )}

                {uploading && (
                  <View style={styles.progressContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.progressText}>Uploading...</Text>
                  </View>
                )}

                {errors && <Text style={styles.errorText}>{errors.message}</Text>}

                {/* Modal */}
                <Modal
                  animationType="slide"
                  transparent={false}
                  visible={modalVisible}
                  onRequestClose={() => setModalVisible(false)}
                >
                  <View style={styles.modalContainer}>
                    <Text style={styles.modalTitle}>Sign Below</Text>
                    <View style={styles.signatureBox}>
                      <SignatureCanvas
                        ref={sigRef}
                        onOK={handleOK}
                        onEnd={handleEnd}
                        autoClear={false}
                        penColor="#000"
                        backgroundColor="#fff"
                        webviewProps={{
                          androidLayerType: "hardware",
                        }}
                        descriptionText=""
                        clearText=""
                        confirmText=""
                      />
                      <View style={styles.modalActions}>
                        <TouchableOpacity
                          onPress={() => handleSave(onChange)}
                          style={[
                            styles.button,
                            uploading && styles.disabledButton,
                          ]}
                          disabled={uploading}
                        >
                          <Text style={styles.buttonText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleClear}
                          style={styles.button}
                          disabled={uploading}
                        >
                          <Text style={styles.buttonText}>Clear</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setModalVisible(false)}
                          style={[styles.button, styles.cancelButton]}
                          disabled={uploading}
                        >
                          <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>
              </>
            )}
          />
        </>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  questionContainer: {
    marginTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  questionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 12,
    lineHeight: 22,
  },
  required: {
    color: "#FF3B30",
  },
  signaturePreview: {
    width: "100%",
    height: 200,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  previewWrapper: {
    alignItems: "center",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 12,
    marginTop: 5,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginHorizontal: 8,
    marginTop: 12,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#999",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  addButton: {
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  addButtonError: {
    borderColor: "red",
    backgroundColor: "#FFF0F0",
  },
  addButtonText: {
    color: "#007AFF",
  },
  addButtonTextError: {
    color: "red",
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: "#999",
  },
  modalContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  signatureBox: {
    width: "100%",
    height: "40%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    overflow: "hidden",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 20,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  progressText: {
    marginLeft: 8,
    color: "#007AFF",
    fontSize: 14,
  },
});

export default CustomSignature;
