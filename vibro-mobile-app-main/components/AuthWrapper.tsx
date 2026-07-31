/* eslint-disable react-hooks/exhaustive-deps */
import { Redirect } from "expo-router";

import { ActivityIndicator, View, StyleSheet } from "react-native";
import { RootState } from "@/store";
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { checkRefetchToken } from "@/Redux/reducer/auth/authSlice";
import { Header } from "./Header";

export default function AuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useDispatch();
  const { loading, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  ) as any;

  useEffect(() => {
    dispatch(checkRefetchToken({ isAuthenticatedVerify: true }));
  }, [isAuthenticated]);

  if (loading) {
    return (
      <>
        <Header isTransparent={true} />
        <View style={styles.container}>
          <ActivityIndicator size="large" color={"#fff"} />
        </View>
      </>
    );
  }

  if (!isAuthenticated && !loading) {
    return <Redirect href="/(auth)/login" />;
  }

  return <>{children}</>;
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2196f3",
    justifyContent: "center",
    alignItems: "center",
  },
});
