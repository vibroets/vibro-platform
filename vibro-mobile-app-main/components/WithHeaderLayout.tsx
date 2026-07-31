import React from "react";
import { View, StyleSheet } from "react-native";
import { Header } from "./Header";

export default function WithHeaderLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.container}>
      <Header title={title} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
