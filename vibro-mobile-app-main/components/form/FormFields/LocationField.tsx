import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Controller } from "react-hook-form";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Question } from "../types/formTypes";
import FormFieldWrapper from "./FormFieldWrapper";

interface LocationFieldProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  isEditable?: boolean;
  hasError?: boolean;
}

const LocationField: React.FC<LocationFieldProps> = ({
  question,
  control,
  errors,
  name,
  isCompleted,
  isEditable = true,
  hasError,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // const getCurrentLocation = async (onChange: (value: any) => void) => {
  //   setIsLoading(true);
  //   try {
  //     const { status } = await Location.requestForegroundPermissionsAsync();

  //     if (status !== "granted") {
  //       Alert.alert(
  //         "Permission Denied",
  //         "Please enable location permissions in your settings to use this feature",
  //         [{ text: "OK" }]
  //       );
  //       return;
  //     }

  //     const location = await Location.getCurrentPositionAsync({
  //       accuracy: Location.Accuracy.BestForNavigation,
  //     });

  //     onChange({
  //       latitude: location.coords.latitude,
  //       longitude: location.coords.longitude,
  //       accuracy: location.coords.accuracy,
  //       timestamp: location.timestamp,
  //     });
  //   } catch (error) {
  //     console.error("Error getting location:", error);
  //     Alert.alert(
  //       "Error",
  //       "Could not get your current location. Please try again.",
  //       [{ text: "OK" }]
  //     );
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  return (
    <FormFieldWrapper question={question} isCompleted={isCompleted} hasError={hasError}>
      {() => (
        <>
          <Controller
            control={control}
            name={name}
            rules={{
              required: question.is_required ? "This field is required" : false,
            }}
            render={({ field: { onChange, value } }) => {
              const hasFieldError = errors[name] || hasError;

              return (
                <View style={[styles.fieldContainer, hasFieldError && styles.fieldErrorContainer]}>
                  <TouchableOpacity
                    style={styles.locationButton}
                    // onPress={() => getCurrentLocation(onChange)}
                    disabled={!isEditable || isLoading}
                  >
                    <MaterialIcons
                      name="my-location"
                      size={20}
                      color={!isEditable || isLoading ? "#ccc" : "#007AFF"}
                    />
                    <Text style={styles.buttonText}>
                      {isLoading ? "Getting Location..." : "Use Current Location"}
                    </Text>
                  </TouchableOpacity>

                  {value && (
                    <View style={styles.coordinatesContainer}>
                      <Text style={styles.coordinatesText}>
                        Latitude: {value.latitude.toFixed(6)}
                      </Text>
                      <Text style={styles.coordinatesText}>
                        Longitude: {value.longitude.toFixed(6)}
                      </Text>
                      {value.accuracy && (
                        <Text style={styles.accuracyText}>
                          Accuracy: {Math.round(value.accuracy)} meters
                        </Text>
                      )}
                    </View>
                  )}

                  {(errors[name] || hasError) && (
                    <Text style={styles.errorText}>
                      {errors[name]?.message || "This field is required"}
                    </Text>
                  )}
                </View>
              );
            }}
          />
        </>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  fieldContainer: {
    marginTop: 8,
  },
  fieldErrorContainer: {
    borderWidth: 1,
    borderColor: "red",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#FFF0F0",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    marginLeft: 10,
    color: "#007AFF",
    fontSize: 16,
  },
  coordinatesContainer: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  coordinatesText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  accuracyText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  errorText: {
    color: "red",
    marginTop: 5,
    fontSize: 14,
  },
  mapPreview: {
    height: 150,
    borderRadius: 8,
    marginTop: 10,
  },
});

export default LocationField;
