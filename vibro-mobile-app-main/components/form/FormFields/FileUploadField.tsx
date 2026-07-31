import { Feather, MaterialIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CLOUDINARY_NAME, CLOUDINARY_SIGN } from "../../../constants/forms";
import { networkService } from "../../../services/networkService";
import { uploadToCloudinary } from "../../../services/uploadToCloudinary";
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

// Stub for Cloudinary delete (you should ideally call your backend API)
const deleteFromCloudinary = async (publicId: string, cloudName: string) => {
  await new Promise((res) => setTimeout(res, 1000)); // Simulate delay

};
// Normalize API variations for live capture flags (supports task close questions payloads)
const coerceLiveCapture = (value: any): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return false;
};

interface FileUploadQuestionProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  isEditable?: boolean;
  hasError?: boolean;
}

// Helper function to get file size from URL
const getFileSizeFromUrl = async (url: string): Promise<number> => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    const contentLength = response.headers.get("Content-Length");
    if (contentLength) {
      return parseInt(contentLength, 10);
    } else {
      // If HEAD doesn't provide Content-Length, download the file to get size
      const getResponse = await fetch(url);
      const blob = await getResponse.blob();
      return blob.size;
    }
  } catch (error) {
    return 0;
  }
};

const parseMediaValue = (
  raw: any,
): { urls: string[]; sizes: { [url: string]: number } } => {
  const urls: string[] = [];
  const sizes: { [url: string]: number } = {};

  const addEntry = (url?: string, size?: any) => {
    if (!url || typeof url !== "string") return;
    const trimmed = url.trim();
    if (!trimmed) return;
    urls.push(trimmed);
    const sizeNumber =
      typeof size === "number"
        ? size
        : typeof size === "string" && size.trim()
          ? Number(size)
          : undefined;
    if (typeof sizeNumber === "number" && !Number.isNaN(sizeNumber)) {
      sizes[trimmed] = sizeNumber;
    }
  };

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (typeof item === "string") {
              addEntry(item);
            } else if (item && typeof item === "object") {
              addEntry(
                item.url || item.uri || item.path || item.file_url || item.file,
                item.size || item.file_size || item.filesize || item.bytes,
              );
            }
          });
          return { urls, sizes };
        }
        if (parsed && typeof parsed === "object") {
          addEntry(
            parsed.url ||
              parsed.uri ||
              parsed.path ||
              parsed.file_url ||
              parsed.file,
            parsed.size || parsed.file_size || parsed.filesize || parsed.bytes,
          );
          return { urls, sizes };
        }
      } catch {
        // fall back to pipe-delimited string
      }
    }

    trimmed
      .split("|")
      .filter(Boolean)
      .forEach((url) => addEntry(url));
    return { urls, sizes };
  }

  if (Array.isArray(raw)) {
    raw.forEach((item: any) => {
      if (typeof item === "string") {
        addEntry(item);
      } else if (item && typeof item === "object") {
        addEntry(
          item.url || item.uri || item.path || item.file_url || item.file,
          item.size || item.file_size || item.filesize || item.bytes,
        );
      }
    });
    return { urls, sizes };
  }

  if (raw && typeof raw === "object") {
    addEntry(
      raw.url || raw.uri || raw.path || raw.file_url || raw.file,
      raw.size || raw.file_size || raw.filesize || raw.bytes,
    );
  }

  return { urls, sizes };
};

const FileUploadField: React.FC<FileUploadQuestionProps> = ({
  question,
  control,
  errors,
  name,
  isCompleted,
  isEditable = true,
  hasError,
}) => {
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [completedFileSizes, setCompletedFileSizes] = useState<{
    [url: string]: number;
  }>({});
  const answerString = question?.answers?.answer || "";
  const [currentRawValue, setCurrentRawValue] = useState<any>(null);

  // Track if files have been initialized for this specific question
  const [filesInitialized, setFilesInitialized] = useState(false);
  const [lastInitializedName, setLastInitializedName] = useState<string>("");
  const [lastHydratedValue, setLastHydratedValue] = useState<string>("");
  const [currentFormValue, setCurrentFormValue] = useState<string>("");

  // Reset files state when switching to a different question (name prop changes)
  useEffect(() => {
    if (name !== lastInitializedName) {
      // Clear files when switching to a different question
      setFiles([]);
      setFilesInitialized(false);
      setCompletedFileSizes({});
      setLastHydratedValue("");
      setCurrentFormValue("");
    }
  }, [name, lastInitializedName]);

  // Initialize files state when form value changes (for both editable and completed forms when loading drafts)
  useEffect(() => {
    const normalizedValue =
      typeof currentFormValue === "string" ? currentFormValue.trim() : "";

    if (name !== lastInitializedName) {
      setLastInitializedName(name);
      setFilesInitialized(false);
      setLastHydratedValue("");
      return;
    }

    if (!normalizedValue) {
      if (!filesInitialized || lastHydratedValue) {
        setFiles([]);
        setFilesInitialized(true);
        setLastHydratedValue("");
      }
      return;
    }

    if (normalizedValue === lastHydratedValue && filesInitialized) {
      return;
    }

    const { urls: urlStrings } = parseMediaValue(normalizedValue);
    if (urlStrings.length === 0) {
      setFiles([]);
      setFilesInitialized(true);
      setLastHydratedValue(normalizedValue);
      return;
    }

    const existingFiles = urlStrings.map((url, index) => {
      const extension = url.split(".").pop()?.toLowerCase() || "";
      const type = extension.match(/(jpg|jpeg|png|gif)/)
        ? "image"
        : extension.match(/(mp4|mov)/)
          ? "video"
          : extension.match(/(mp3|wav)/)
            ? "audio"
            : "file";

      return {
        uri: url,
        name: `Existing File ${index + 1}`,
        type: type,
        size: 0,
      };
    });

    setFiles(existingFiles);
    setFilesInitialized(true);
    setLastHydratedValue(normalizedValue);

    const fetchFileSizes = async () => {
      const updatedFiles = [...existingFiles];
      const promises = updatedFiles.map(async (file, index) => {
        const size = await getFileSizeFromUrl(file.uri);
        updatedFiles[index] = { ...file, size };
      });
      await Promise.all(promises);
      setFiles((currentFiles) => {
        const currentUris = currentFiles.map((file) => file.uri).join("|");
        const hydratedUris = existingFiles.map((file) => file.uri).join("|");
        return currentUris === hydratedUris ? updatedFiles : currentFiles;
      });
    };

    fetchFileSizes();
  }, [
    name,
    filesInitialized,
    lastInitializedName,
    lastHydratedValue,
    currentFormValue,
  ]);

  // Fetch file sizes for non-editable forms (preview or completed)
  useEffect(() => {
    if (!isEditable) {
      const { urls: previewUrls, sizes: parsedSizes } = parseMediaValue(
        (currentRawValue ?? currentFormValue) || answerString || "",
      );

      if (previewUrls.length === 0) return;

      const fetchCompletedFileSizes = async () => {
        const sizesMap: { [url: string]: number } = { ...parsedSizes };

        // Prefer sizes from current in-memory files (for preview of newly added files)
        files.forEach((file) => {
          if (file?.uri && typeof file.size === "number") {
            sizesMap[file.uri] = file.size;
          }
        });

        const urlsToFetch = previewUrls.filter((url) => {
          const existingSize = sizesMap[url];
          if (existingSize != null && existingSize > 0) return false;
          if (url.startsWith("file://") || url.startsWith("content://"))
            return false;
          return true;
        });

        const promises = urlsToFetch.map(async (url) => {
          const size = await getFileSizeFromUrl(url);
          sizesMap[url] = size;
        });

        await Promise.all(promises);
        setCompletedFileSizes(sizesMap);
      };

      fetchCompletedFileSizes();
    }
  }, [
    answerString,
    currentFormValue,
    currentRawValue,
    files,
    isEditable,
    name,
  ]);

  const handleNewFiles = async (
    assets: any[],
    type: "image" | "video" | "audio" | "file",
    onChange: (value: string) => void,
  ) => {
    const isOffline = networkService.isOffline();

    // If offline, skip Cloudinary upload and store local URIs so they can be synced later
    if (isOffline) {
      try {
        const newFiles = assets.map((asset) => {
          const mimeType =
            asset.mimeType ||
            asset.type ||
            (type === "video"
              ? "video/mp4"
              : type === "audio"
                ? "audio/mpeg"
                : "image/jpeg");
          const extension =
            mimeType.split("/")[1] || (type === "audio" ? "mp3" : "jpg");

          return {
            uri: asset.uri, // local file URI
            name: asset.name || `${type}_${Date.now()}.${extension}`,
            type: mimeType,
            size: asset.fileSize || asset.size || 0,
          };
        });

        const updatedFiles = [...files, ...newFiles].slice(
          0,
          question?.number_of_file_allowed || 5,
        );

        setFiles(updatedFiles);
        const joinedUrls = updatedFiles.map((f) => f.uri).join("|");
        onChange(joinedUrls);
      } catch (err: any) {
        Alert.alert(
          "Offline Error",
          err?.message || "Failed to attach file locally.",
        );
      }
      return;
    }

    // Online path – upload to Cloudinary
    Alert.alert(
      "Upload Confirmation",
      "Upload selected file(s) to Cloudinary?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upload",
          onPress: async () => {
            try {
              setUploading(true);
              const uploaded: any[] = [];

              for (const asset of assets) {
                try {
                  const mimeType =
                    asset.mimeType ||
                    asset.type ||
                    (type === "video"
                      ? "video/mp4"
                      : type === "audio"
                        ? "audio/mpeg"
                        : "image/jpeg");
                  const extension =
                    mimeType.split("/")[1] ||
                    (type === "audio" ? "mp3" : "jpg");

                  const file = {
                    uri: asset.uri,
                    name: asset.name || `${type}_${Date.now()}.${extension}`,
                    type: mimeType,
                  };

                  const cloudinaryUrl = await uploadToCloudinary(
                    file,
                    CLOUDINARY_SIGN,
                    CLOUDINARY_NAME,
                  );

                  uploaded.push({
                    uri: cloudinaryUrl,
                    name: file.name,
                    type,
                    size: asset.fileSize || asset.size || 0,
                  });
                } catch (uploadErr: any) {
                }
              }

              if (uploaded.length === 0) {
                Alert.alert(
                  "Upload Failed",
                  "None of the files could be uploaded.",
                );
                return;
              }

              const updatedFiles = [...files, ...uploaded].slice(
                0,
                question?.number_of_file_allowed || 5,
              );

              setFiles(updatedFiles);
              const joinedUrls = updatedFiles.map((f) => f.uri).join("|");
              onChange(joinedUrls);
            } catch (err: any) {
              Alert.alert(
                "Upload Failed",
                err?.message || "Something went wrong.",
              );
            } finally {
              setUploading(false);
            }
          },
        },
      ],
    );
  };

  const pickFile = async (onChange: (value: string) => void) => {
    try {
      const allowsMultiple = question.number_of_file_allowed !== 1;

      // Check if live capture is required
      const requiresLiveCapture = coerceLiveCapture(
        (question as any)?.require_live ??
          (question as any)?.require_live_capture ??
          (question as any)?.require_live_image ??
          (question as any)?.live_image_toggle ??
          (question as any)?.live_image ??
          (question as any)?.live_capture,
      );

      if (question.question_type === "upload_image") {
        const openImageCamera = async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            alert("Camera permission required!");
            return;
          }

          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
          });

          if (!result.canceled) {
            handleNewFiles([result.assets[0]], "image", onChange);
          }
        };

        const openImageGallery = async () => {
          const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            alert("Camera roll permission required!");
            return;
          }

          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: allowsMultiple,
            quality: 0.8,
          });

          if (!result.canceled) {
            handleNewFiles(result.assets, "image", onChange);
          }
        };

        if (requiresLiveCapture) {
          await openImageCamera();
        } else {
          Alert.alert("Add Image", "Choose how you want to add an image.", [
            { text: "Cancel", style: "cancel" },
            { text: "Take Image", onPress: openImageCamera },
            { text: "Upload Image from Gallery", onPress: openImageGallery },
          ]);
        }
      } else if (question.question_type === "upload_video") {
        const openVideoCamera = async () => {
          const { status: cameraStatus } =
            await ImagePicker.requestCameraPermissionsAsync();
          if (cameraStatus !== "granted") {
            alert("Camera permission required!");
            return;
          }

          const { status: micStatus } = await Audio.requestPermissionsAsync();
          if (micStatus !== "granted") {
            alert("Microphone permission required for video!");
            return;
          }

          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: false,
          });

          if (!result.canceled) {
            handleNewFiles([result.assets[0]], "video", onChange);
          }
        };

        const openVideoGallery = async () => {
          const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            alert("Camera roll permission required!");
            return;
          }

          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsMultipleSelection: allowsMultiple,
          });

          if (!result.canceled) {
            handleNewFiles(result.assets, "video", onChange);
          }
        };

        if (requiresLiveCapture) {
          await openVideoCamera();
        } else {
          Alert.alert("Add Video", "Choose how you want to add a video.", [
            { text: "Cancel", style: "cancel" },
            { text: "Take Video", onPress: openVideoCamera },
            { text: "Upload Video from Gallery", onPress: openVideoGallery },
          ]);
        }
      } else if (question.question_type === "upload_audio") {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["audio/*"],
          multiple: allowsMultiple,
        });

        if (!result.canceled && result.assets) {
          handleNewFiles(result.assets, "audio", onChange);
        }
      } else if (question.question_type === "upload_file") {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["*/*"],
          multiple: allowsMultiple,
        });

        if (!result.canceled && result.assets) {
          handleNewFiles(result.assets, "file", onChange);
        }
      }
    } catch (error) {
    }
  };

  const removeFile = async (
    fileToRemove: any,
    currentValue: string,
    onChange: (value: string) => void,
  ) => {
    // Check if this is an existing file (from database) vs newly uploaded file
    const isExistingFile =
      typeof fileToRemove?.name === "string" &&
      fileToRemove.name.startsWith("Existing File");

    try {
      // For newly uploaded files, delete from Cloudinary
      if (!isExistingFile) {
        const publicId = extractCloudinaryPublicId(fileToRemove.uri);
        await deleteFromCloudinary(publicId, "cdley8e7");
      }

      const currentUrls = parseMediaValue(currentValue || "").urls;
      const updatedUrls = currentUrls.filter(
        (url) => url !== fileToRemove.uri,
      );
      const updatedFiles = files.filter((f) => f.uri !== fileToRemove.uri);
      setFiles(updatedFiles);
      onChange(updatedUrls.join("|"));
    } catch (error: any) {
      Alert.alert("Delete Failed", error?.message || "Could not delete file.");
    } finally {
      setDeletingIndex(null);
    }
  };

  const getFileIcon = (type: string) => {
    switch (true) {
      case type.includes("image"):
        return <Feather name="image" size={20} color="#666" />;
      case type.includes("video"):
        return <Feather name="video" size={20} color="#666" />;
      case type.includes("audio"):
        return <Feather name="music" size={20} color="#666" />;
      default:
        return <Feather name="file" size={20} color="#666" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <FormFieldWrapper
      question={question}
      isCompleted={isCompleted}
      hasError={hasError}
    >
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
              required: question.is_required
                ? "Please upload at least one file"
                : false,
              validate: (value) =>
                !question.is_required ||
                (value && value.length > 0) ||
                "Please upload at least one file",
            }}
            render={({ field: { onChange, value } }) => {
              // Update the state with current value so useEffect can properly react to it
              // Only update if value is different to avoid infinite loops
              React.useEffect(() => {
                if (value !== currentRawValue) {
                  setCurrentRawValue(value);
                }
                if (typeof value === "string" && value !== currentFormValue) {
                  setCurrentFormValue(value);
                }
              }, [value, currentRawValue, currentFormValue]);

              // Clear local previews when the field is reset from outside
              React.useEffect(() => {
                if (!value && files.length > 0) {
                  setFiles([]);
                  setFilesInitialized(true);
                  setLastHydratedValue("");
                  setCurrentFormValue("");
                }
              }, [value, files.length]);

              const parsedMedia = parseMediaValue(
                isEditable ? (value ?? "") : (value ?? answerString)
              );
              const mediaUrls = parsedMedia.urls;

              // Build the display list directly from the form value so stale
              // local state is never shown after a clear.
              const displayFiles = React.useMemo(() => {
                const typeFromUrl = (url: string) => {
                  const ext = url.split(".").pop()?.toLowerCase() || "";
                  return ext.match(/(jpg|jpeg|png|gif)/)
                    ? "image"
                    : ext.match(/(mp4|mov)/)
                      ? "video"
                      : ext.match(/(mp3|wav)/)
                        ? "audio"
                        : "file";
                };
                const valueFiles = mediaUrls.map((url, index) => ({
                  uri: url,
                  name: `Existing File ${index + 1}`,
                  type: typeFromUrl(url),
                  size: completedFileSizes[url] ?? parsedMedia.sizes[url] ?? 0,
                }));
                // Keep local files that are still being uploaded (not yet in the value)
                const localFiles = files.filter((f) => {
                  if (!f.uri) return false;
                  if (mediaUrls.includes(f.uri)) return false;
                  const uriStr = String(f.uri);
                  return (
                    uriStr.startsWith("file://") ||
                    uriStr.startsWith("content://")
                  );
                });
                return [...localFiles, ...valueFiles];
              }, [mediaUrls, files, parsedMedia, completedFileSizes]);

              const uploadLabel =
                question.question_type === "upload_video"
                  ? "Add Video"
                  : question.question_type === "upload_image"
                    ? "Add Image"
                    : question.question_type === "upload_audio"
                      ? "Add Audio"
                      : "Add File";

              const maxFiles = question?.number_of_file_allowed || 5;
              const canAddMore = displayFiles.length < maxFiles;

              return (
                <>
                  {mediaUrls.length > 0 && !isEditable && (
                    <View style={styles.fileList}>
                      {mediaUrls.map((url: string, index: number) => {
                        const extension =
                          url.split(".").pop()?.toLowerCase() || "";
                        const type = extension.match(/(jpg|jpeg|png|gif)/)
                          ? "image"
                          : extension.match(/(mp4|mov)/)
                            ? "video"
                            : extension.match(/(mp3|wav)/)
                              ? "audio"
                              : "file";

                        return (
                          <TouchableOpacity
                            key={index}
                            style={styles.fileItem}
                            onPress={() => Linking.openURL(url)}
                          >
                            <View style={styles.fileIconContainer}>
                              {type === "image" ? (
                                <Image
                                  source={{ uri: url }}
                                  style={styles.fileThumbnail}
                                />
                              ) : (
                                getFileIcon(type)
                              )}
                            </View>
                            <View style={styles.fileInfo}>
                              <Text
                                style={styles.fileName}
                                numberOfLines={1}
                              >
                                File {index + 1}
                              </Text>
                              <Text style={styles.fileSize}>
                                {formatFileSize(
                                  completedFileSizes[url] ??
                                    parsedMedia.sizes[url] ??
                                    0,
                                )}{" "}
                                - Tap to Download
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {isEditable && (
                    <TouchableOpacity
                      style={[
                        styles.uploadButton,
                        (errors[name] || hasError) && styles.uploadButtonError,
                        !canAddMore && styles.uploadButtonDisabled,
                      ]}
                      onPress={() => {
                        if (!canAddMore) return;
                        Keyboard.dismiss();
                        pickFile(onChange);
                      }}
                      activeOpacity={0.7}
                      disabled={uploading || !canAddMore}
                    >
                      <View style={styles.uploadButtonIcon}>
                        <MaterialIcons
                          name={
                            question.question_type === "upload_video"
                              ? "videocam"
                              : question.question_type === "upload_image"
                                ? "photo-camera"
                                : question.question_type === "upload_audio"
                                  ? "mic"
                                  : "insert-drive-file"
                          }
                          size={22}
                          color="#fff"
                        />
                      </View>
                      <Text style={styles.uploadButtonText}>
                        {question.require_live
                          ? `Capture ${uploadLabel.toLowerCase().replace("add ", "")}`
                          : uploadLabel}
                      </Text>
                      <View style={styles.uploadButtonAddIcon}>
                        <MaterialIcons name="add" size={22} color="#007AFF" />
                      </View>
                    </TouchableOpacity>
                  )}

                  {!isEditable && mediaUrls.length === 0 && (
                    <View
                      style={[styles.uploadButton, styles.uploadButtonDisabled]}
                    >
                      <View style={styles.uploadButtonIcon}>
                        <MaterialIcons
                          name="cloud-off"
                          size={22}
                          color="#fff"
                        />
                      </View>
                      <Text style={styles.uploadButtonTextMuted}>
                        {question.question_hint || "No file selected"}
                      </Text>
                    </View>
                  )}

                  {uploading && (
                    <View style={styles.progressContainer}>
                      <ActivityIndicator size="large" color="#007AFF" />
                      <Text style={styles.progressText}>Uploading...</Text>
                    </View>
                  )}

                  {displayFiles.length > 0 && isEditable && (
                    <View style={styles.fileList}>
                      {displayFiles.map((file, index) => (
                        <View key={index} style={styles.fileItem}>
                          <View style={styles.fileIconContainer}>
                            {file.type.includes("image") ? (
                              <Image
                                source={{ uri: file.uri }}
                                style={styles.fileThumbnail}
                              />
                            ) : (
                              getFileIcon(file.type)
                            )}
                          </View>
                          <View style={styles.fileInfo}>
                            <Text style={styles.fileName} numberOfLines={1}>
                              {file.name}
                            </Text>
                            <Text style={styles.fileSize}>
                              {formatFileSize(file.size)}
                            </Text>
                          </View>
                          {deletingIndex === index ? (
                            <View style={styles.removeButton}>
                              <ActivityIndicator size="small" color="#ff4444" />
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.removeButton}
                              onPress={() => {
                                setDeletingIndex(index);
                                removeFile(file, value ?? "", onChange);
                              }}
                            >
                              <MaterialIcons
                                name="close"
                                size={20}
                                color="#ff4444"
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </>
              );
            }}
          />
        </>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
  },
  containerError: {
    borderWidth: 1,
    borderColor: "#ff4444",
    backgroundColor: "#fff0f0",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  labelError: {
    color: "#ff4444",
  },
  required: {
    color: "#ff4444",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8f9fa",
  },
  uploadButtonError: {
    borderColor: "#ff4444",
    backgroundColor: "#fff0f0",
  },
  uploadButtonDisabled: {
    opacity: 0.55,
  },
  uploadButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  uploadButtonText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  uploadButtonTextMuted: {
    flex: 1,
    fontSize: 15,
    color: "#999",
  },
  uploadButtonAddIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e6f0ff",
    alignItems: "center",
    justifyContent: "center",
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
  fileList: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    marginTop: 8,
  },
  fileListError: {
    borderColor: "#ff4444",
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  fileIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  fileThumbnail: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    color: "#333",
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: "#999",
  },
  removeButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#ff4444",
    marginTop: 8,
    fontSize: 14,
  },
});

export default FileUploadField;
