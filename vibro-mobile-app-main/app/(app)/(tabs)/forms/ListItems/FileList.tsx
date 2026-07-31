import { ItemsProps } from "@/types/forms";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import FeatherIcon from "react-native-vector-icons/Feather";
import SimpleLineIconsIcon from "react-native-vector-icons/SimpleLineIcons";
import React from "react";

const FileList = (props: ItemsProps) => (
  <TouchableOpacity
    onPress={() => {
      props.onClick?.(props.items as any);
    }}
    style={styles.container}
  >
    <View style={styles.leftSection}>
      <FeatherIcon name="file-text" size={24} color="#6b7280" />
      <Text style={styles.text}>{props.items.form? props.items.form.title : props.items.title}</Text>
    </View>
    <SimpleLineIconsIcon name="arrow-right" size={22} color="#6b7280" style={styles.arrowIcon} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D3D3D3',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  text: {
    fontSize: 16,
    color: '#1f2937', // text-gray-800
    paddingLeft: 8,
    flex: 1,
    flexShrink: 1,
  },
  arrowIcon: {
    marginLeft: 8,
  },
});

export default FileList;
