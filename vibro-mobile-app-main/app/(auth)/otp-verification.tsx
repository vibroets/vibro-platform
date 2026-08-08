/* eslint-disable react-hooks/exhaustive-deps */
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

import { Header } from "@/components/Header";
import { checkRefetchToken } from "@/Redux/reducer/auth/authSlice";
import { Api } from "@/services/authApi";
import { RootState } from "@/store";
import { onShowTostMessage } from "@/utility";

interface HandleChangeFn {
  (text: string, index: number, onChange: (value: string) => void): void;
}

export default function OtpVerificationScreen() {
  const params = useLocalSearchParams();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  ) as any;

  const [loading, setLoading] = useState(false);
  const [isOtpLoading, setOtpLoading] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      otp: Array(6).fill(""),
    },
  });
  const inputRefs = useRef(
    Array.from({ length: 6 }, () => React.createRef<TextInput>())
  ).current;

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, [inputRefs]);

  const handleChange: HandleChangeFn = (text, index, onChange) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, "");
    onChange(numericValue);

    // Auto-focus next input
    if (numericValue && index < 5) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-focus previous input on backspace
    if (!numericValue && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  useEffect(() => {
    if (params && Object.keys(params).length > 0) {
      onShowTostMessage({
        message: params?.message,
        toastType: "success",
      });
    }
  }, [params?.email]);

  const onSubmit = async (data: any) => {
    setOtpLoading(true);
    const otp = data.otp.join("");

    const identifier =
      Array.isArray(params?.email) ? params.email[0] : params?.email;

    if (!identifier) {
      onShowTostMessage({ message: "Invalid login identifier" });
      setOtpLoading(false);
      return;
    }

    try {

      const { isAxiosError, message, ...res } = await Api.verifyOTP({
        identifier,              // ✅ string
        otp,
        platform: "mobile",
      });

      if (isAxiosError) {
        onShowTostMessage({ message });
      } else {
        dispatch(
          checkRefetchToken({ ...res, isAuthenticatedVerify: false })
        );
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const reSentOtp = async () => {
    setLoading(true);
    reset({ otp: Array(6).fill("") });
    try {
      const { isAxiosError, message, ...res } = (await Api.verifyEmail({
        email: params?.email,
      })) as any;
      if (isAxiosError) {
        onShowTostMessage({ message });
      } else {
        onShowTostMessage({ ...res, message, toastType: "success" });
      }
    } finally {
      setLoading(false);
    }
  };
  // if (isAuthenticated) {
  //   return router.replace("/(app)/(tabs)");
  // }

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(app)/(tabs)");
    }
  }, [isAuthenticated]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#2196f3" }} edges={['bottom']}>
      <Header isTransparent={true} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerContainer}>
            <Text style={styles.headingText}>Enter OTP</Text>
            <View style={styles.otpContainer}>
              {[...Array(6)].map((_, index) => (
                <Controller
                  key={index}
                  control={control}
                  name={`otp.${index}`}
                  defaultValue=""
                  rules={{
                    required: true,
                    pattern: /^[0-9]$/,
                  }}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      ref={inputRefs[index]}
                      style={[
                        styles.otpInput,
                        index !== 6 ? { marginRight: 10 } : {},
                        errors.otp?.[index] && styles.errorInput,
                      ]}
                      value={value}
                      onChangeText={(text) => handleChange(text, index, onChange)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                      textContentType="oneTimeCode"
                      editable={!isOtpLoading}
                    />
                  )}
                />
              ))}
            </View>
            {errors.otp && (
              <Text style={styles.errorLabel}>
                Please enter a valid 6-digit OTP
              </Text>
            )}
            <TouchableOpacity
              style={styles.blueRoundedContainer}
              onPress={handleSubmit(onSubmit)}
              activeOpacity={0.8}
              disabled={isOtpLoading}
            >
              <Text style={styles.btnTextStyle}>
                {isOtpLoading ? "Verifying..." : "Verify OTP"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkContainer}
              onPress={() => {
                !loading && reSentOtp();
              }}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.btnLinkTextStyle}>
                {loading ? "Sending resent OTP..." : "Resent OTP"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2196f3",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  innerContainer: {
    // paddingHorizontal: 15,
    alignItems: "center",
  },
  headingText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginBottom: 30, // Adds small spacing below the text
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    // width: "80%",
    marginBottom: 30,
  },
  otpInput: {
    width: 45,
    height: 50,
    borderWidth: 2,
    borderColor: "#ccc",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 15,
    backgroundColor: "#fff",
  },
  errorInput: {
    borderColor: "red",
  },
  blueRoundedContainer: {
    marginTop: 10,
    backgroundColor: "#bfdbff",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    width: "80%",
  },
  linkContainer: {
    marginTop: 10,
    //backgroundColor: "#bfdbff",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    width: "80%",
  },
  btnTextStyle: {
    color: "#0f172a", // text-[#0f172a]
    fontSize: 18, // text-lg (typically 18px in React Native)
    fontWeight: "600", // font-semibold (600 is semibold, 'bold' is 700)
  },
  btnLinkTextStyle: {
    color: "#fff", // text-[#0f172a]
    fontSize: 18, // text-lg (typically 18px in React Native)
    fontWeight: "600", // font-semibold (600 is semibold, 'bold' is 700)
  },
  errorLabel: {
    fontSize: 14,
    fontWeight: "bold",
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 10,
    backgroundColor: "#fff",
    opacity: 0.6,
    textAlign: "center",
    // width: "50%",
    borderRadius: 3,
    paddingRight: 10,
    color: "red",
    marginBottom: 15,
  },
});
