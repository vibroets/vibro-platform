import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import FeatherIcon from "react-native-vector-icons/Feather";
import SimpleLineIconsIcon from "react-native-vector-icons/SimpleLineIcons";
import React from "react";
import { Received } from "@/types/received";

interface FileListProps {
  items: Received;
  formId: any;
  formTitle?: string;
  onClick?: (formId: any, submissionId: any, stageId: any, formTitle?: string) => void;
}

const FileList = ({ items, formId, formTitle, onClick }: FileListProps) => {
  const parseDateTime = (value?: string | null): Date | null => {
    if (!value) return null;
    const input = String(value).trim();
    if (!input) return null;

    // Handle backend values like "YYYY-MM-DD HH:mm:ss" as local time.
    const localMatch = input.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (localMatch) {
      const [, y, m, d, hh = "0", mm = "0", ss = "0"] = localMatch;
      const parsed = new Date(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(hh),
        Number(mm),
        Number(ss)
      );
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const title = `Submission # ${items.id}`;
  const isCompleted = items.is_completed;
  const statusText = isCompleted ? `Completed` : "Pending";
  const rawDate = isCompleted ? items.completed_on : items.submission_initiated_on;
  const parsedDate = parseDateTime(rawDate);
  const dateText = parsedDate
    ? parsedDate.toLocaleDateString()
    : "N/A";
  const timeText = parsedDate
    ? parsedDate.toLocaleTimeString()
    : "N/A";
  const date = isCompleted ? `Completed on ${dateText} ${timeText}` : `Initiated on ${dateText} ${timeText}`;

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => {
        onClick?.(formId, items.id, items.stage_id, formTitle);
      }}
    >
      <View style={styles.left}>
        <FeatherIcon name="file-text" size={24} color="#6b7280" />
        <View style={{ marginLeft: 8 }}>
          <Text style={styles.title}>{title}</Text>
          <Text>Stage : {items.stage_name}</Text>
          <Text style={isCompleted ? styles.completed : styles.pending}>
            {statusText}
          </Text>
          <Text>{date}</Text>
        </View>
      </View>
      <SimpleLineIconsIcon name="arrow-right" size={22} color="#6b7280" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#D3D3D3",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    color: "#374151", // Tailwind's text-gray-800
    fontWeight: "500",
  },
  pending: {
    marginTop: 2,
    fontSize: 14,
    color: "#D97706", // Tailwind's yellow-600
    fontWeight: "500",
  },
  completed: {
    marginTop: 2,
    fontSize: 14,
    color: "#059669", // Tailwind's green-600
    fontWeight: "500",
  },
  dateText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  editedText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "500",
    marginTop: 2,
  },
});

export default FileList;
