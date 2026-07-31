// Box/index.tsx
import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

type BoxProps = {
  bgColor?: string;
  iconName: string;
  iconColor?: string;
  countColor?: string;
  count: number;
  label: string;
  onPress?: () => void;
};

const Box = ({
  bgColor = "#E5E7EB",
  iconName,
  iconColor = "#666",
  countColor = "#1F2937",
  count,
  label,
  onPress,
}: BoxProps) => {
  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <Icon name={iconName} size={24} color={iconColor} />
      </View>
      <Text style={[styles.countText, { color: countColor }]}>{count}</Text>
      <Text style={styles.labelText}>{label}</Text>
    </TouchableOpacity>
  );
};

export default Box;

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    width: 120,
    height: 100,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    // elevation: 1,
    // shadowColor: "#000",
    // shadowOffset: {
    //   width: 0,
    //   height: 1,
    // },
    // shadowOpacity: 0.1,
    // shadowRadius: 2,
  },
  iconContainer: {
    marginBottom: 4,
  },
  countText: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 2,
  },
  labelText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "500",
  },
});
