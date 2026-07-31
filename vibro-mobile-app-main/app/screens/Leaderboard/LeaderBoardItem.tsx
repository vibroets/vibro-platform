import { View, Text, StyleSheet, Image } from "react-native";
import React from "react";
import Icon from "react-native-vector-icons/MaterialIcons";

interface LeaderboardUser {
  id: number;
  name: string;
  score: number;
  position: number;
  subtitle?: string;
  avatar: any; // Consider using ImageSourcePropType for better type safety
}

interface LeaderboardItemProps {
  user: LeaderboardUser;
}

const LeaderboardItem = ({ user }: LeaderboardItemProps) => {
  return (
    <View key={user.id} style={styles.listItem}>
      <Text style={styles.position}>{user.position}</Text>
      <Image source={user.avatar} style={styles.smallAvatar} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.name}</Text>
        {user.subtitle && (
          <Text style={styles.userSubtitle}>{user.subtitle}</Text>
        )}
      </View>
      <View style={styles.scoreContainer}>
        <Text style={styles.score}>{user.score}</Text>
        <Icon name="star" color="#FFD700" size={16} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  listItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  position: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#666",
    width: 24,
    textAlign: "center" as const,
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 16,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#333",
  },
  userSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  scoreContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  score: {
    fontSize: 16,
    fontWeight: "bold" as const,
    color: "#333",
    marginRight: 4,
  },
});

export default LeaderboardItem;