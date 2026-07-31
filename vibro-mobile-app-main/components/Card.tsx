import React from "react";
import { StyleSheet, Text, View } from "react-native";

const Card: React.FC<{
  title: string;
  children?: React.ReactNode;
  viewed?: boolean;
}> = ({ title, children, viewed }) => (
  <View style={[styles.card, viewed && styles.viewedCard]}>
    <Text style={styles.title}>{title}</Text>
    <View style={styles.underline} />
    <View style={styles.content}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 10,
    margin: 0,
    // Shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    // Shadow for Android
    elevation: 5,
    flex: 1,
  },
  viewedCard: {
    backgroundColor: "#f0f0f0",
  },
  title: {
    fontSize: 13,
    paddingBottom: 5,
    paddingTop: 5,
    fontWeight: "bold",
    marginBottom: 4,
  },
  underline: {
    height: 2,
    backgroundColor: "#D3D3D3",
    marginBottom: 12,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    // Add content styling if needed
  },
});

export default Card;
