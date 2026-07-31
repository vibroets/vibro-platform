import { ItemsProps } from "@/types/forms";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import OcticonsIcon from "react-native-vector-icons/Octicons";
import React from "react";

const FolderList = (props: ItemsProps) => (
  <TouchableOpacity
    style={styles.container}
    onPress={() => {
      props.onClick?.(props.items as any);
    }}
  >
    <OcticonsIcon
      name="file-directory"
      size={24}
      color="#6b7280"
      style={styles.icon}
    />
    <Text style={styles.text}>{props.items.name}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D3D3D3',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 16,
    color: '#111827', // text-gray-900
  },
});

export default FolderList;
