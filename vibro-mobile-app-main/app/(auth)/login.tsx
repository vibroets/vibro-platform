import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { Textbox } from "@/components/FormFields";
import { onShowTostMessage } from "@/utility";
import { router } from "expo-router";

import { Api } from "@/services/authApi";

import { Header } from "@/components/Header";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

const vibroLogo = require("../../vibro_logo.jpeg");

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(app)/(tabs)/home");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isAuthenticated) {
        router.replace("/(app)/(tabs)/home");
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [isAuthenticated]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
    },
  });
  const emailValue = watch("email");
  React.useEffect(() => {
    if (inlineError) {
      setInlineError(null);
    }
  }, [emailValue]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const { isAxiosError, message, ...res } = (await Api.verifyEmail({
        email: data.email, // email OR phone
        platform: "mobile",
      })) as any;
      if (isAxiosError) {
        setInlineError(message);
        onShowTostMessage({ message });
      } else {
        router.push({
          pathname: "/(auth)/otp-verification",
          params: { ...data, ...res, message },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#2196f3" }} edges={['bottom']}>
      <Header isTransparent={true} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerContainer}>
            <View style={styles.viewContainer}>
              <View style={styles.circularContainer}>
                <Image source={vibroLogo} style={styles.logoImage} />
                {/* <View style={styles.circleBadgeOne} />
                <View style={styles.circleBadgeTwo} /> */}
              </View>
              <Text style={styles.headingText}>Welcome to Vibro</Text>
              <Text style={styles.headingSmallText}>Login with your email</Text>
            </View>
            <Textbox
              control={control}
              style={[styles.transparentBottomBorderText]}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Enter your email"
              placeholderTextColor="#999"
              name={"email"}
              rules={{
                required: "Email or phone number is required",
                validate: (value: string) => {
                  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

                  const phoneRegex = /^\d{10}$/; // 10 digits number

                  return (
                    emailRegex.test(value) ||
                    phoneRegex.test(value) ||
                    "Enter a valid email or phone number"
                  );
                },
              }}
              label={"Email"}
              styleLabel={styles.styleLabel}
              errorLabel={styles.errorLabel}
              error={errors["email"]}
            />
            <TouchableOpacity
              style={styles.blueRoundedContainer}
              onPress={handleSubmit(onSubmit)}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.btnText}>
                {loading ? "Sending..." : "Send OTP"}
              </Text>
            </TouchableOpacity>
            {inlineError && (
              <Text style={styles.inlineError}>{inlineError}</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast />
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
    paddingHorizontal: 15,
  },
  viewContainer: {
    alignItems: "center", // Centers children horizontally
    marginBottom: 10, // Adds 48px bottom margin
  },
  circularContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    position: "relative",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  logoImage: {
    width: 120,
    height: 120,
    resizeMode: "contain",
  },
  circleBadgeOne: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#bfdbff",
  },
  circleBadgeTwo: {
    position: "absolute",
    bottom: -8,
    left: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#bfdbff",
  },
  largeBoldText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "white",
  },
  headingText: {
    fontSize: 30,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4, // Adds small spacing below the text
  },
  headingSmallText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4, // Adds small spacing below the text
  },
  styleLabel: {
    fontSize: 15,
    color: "#fff",
    letterSpacing: 1,
  },
  errorLabel: {
    fontSize: 14,
    fontWeight: "bold",
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 5,
    backgroundColor: "#fff",
    opacity: 0.6,
    textAlign: "center",
    // width: "50%",
    borderRadius: 3,
  },
  transparentBottomBorderText: {
    // backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
    //color: "white",
    fontSize: 14,
    padding: 15,
    marginTop: 5,
    marginBottom: 5,
    letterSpacing: 1,
  },
  blueRoundedContainer: {
    marginTop: 10,
    backgroundColor: "#bfdbff",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  inlineError: {
    marginTop: 8,
    color: "#dc2626", // red-600
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
});
