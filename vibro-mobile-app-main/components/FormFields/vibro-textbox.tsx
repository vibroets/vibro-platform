import React from "react";
import { Control, Controller, FieldError } from "react-hook-form";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

interface TextboxProps extends TextInputProps {
  name: string;
  control?: Control<any>;
  label?: string;
  rules?: object;
  error?: FieldError;
  isRequired?: boolean;
  style?: object;
  styleLabel?: object;
  errorLabel?: object;
}

const Textbox: React.FC<TextboxProps> = ({
  name,
  control,
  label,
  rules,
  error,
  isRequired,
  style,
  styleLabel,
  errorLabel,
  ...textInputProps
}) => (
  <View style={styles.container}>
    {label && (
      <Text style={[styles.label, styleLabel]}>
        {label}
        {isRequired && <Text style={styles.required}> *</Text>}
      </Text>
    )}
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, onBlur, value } }) => (
        <TextInput
          style={[styles.input, error ? styles.inputError : null, style]}
          onBlur={onBlur}
          onChangeText={onChange}
          value={value}
          {...textInputProps}
        />
      )}
    />
    {error && (
      <Text style={[styles.errorText, errorLabel]}>{error.message}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    gap:10
  },
  label: {
    marginBottom: 4,
    fontWeight: "bold",
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "red",
  },
  errorText: {
    color: "red",
    marginTop: 4,
    fontSize: 12,
  },
  required: {
    color: "red",
  },
});

export default Textbox;