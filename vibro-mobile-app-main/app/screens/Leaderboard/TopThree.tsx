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

interface TopThreeProps {
  users: LeaderboardUser[];
}

const TopThree = ({ users }: TopThreeProps) => {
  const orderedTopThree = [users[1], users[0], users[2]]; // 2nd, 1st, 3rd

  return (
    <View style={styles.topThreeContainer}>
      {orderedTopThree.map((user, index) => (
        <View key={user.id} style={styles.topThreeItem}>
          <View
            style={[
              styles.crownContainer,
              user.position === 1 && styles.firstPlace,
            ]}
          >
            <Text style={styles.crownText}>{user.position}</Text>
          </View>
          <View style={styles.avatarContainer}>
            <Image
              source={user.avatar}
              style={[
                styles.avatar,
                user.position === 1 && styles.firstPlaceAvatar,
              ]}
            />
          </View>
          <Text style={styles.topThreeName}>{user.name}</Text>
          <View style={styles.scoreContainer}>
            <Text style={styles.topThreeScore}>{user.score}</Text>
            <Icon name="star" color="#FFD700" size={16} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  topThreeContainer: {
    backgroundColor: "#fff",
    paddingVertical: 24,
    paddingHorizontal: 16,
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    alignItems: "flex-end" as const,
  },
  topThreeItem: {
    alignItems: "center" as const,
    flex: 1,
  },
  crownContainer: {
    width: 22,
    height: 22,
    borderRadius: 16,
    backgroundColor: "#FFD700",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    // marginBottom: 1,
  },
  firstPlace: {
    backgroundColor: "#FFD700",
    width: 26,
    height: 26,
    borderRadius: 18,
  },
  crownText: {
    color: "#fff",
    fontWeight: "bold" as const,
    fontSize: 16,
  },
  avatarContainer: {
    marginBottom: 8,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  firstPlaceAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  topThreeName: {
    fontSize: 14,
    fontWeight: "600" as const,
    textAlign: "center" as const,
    marginBottom: 4,
    color: "#333",
  },
  scoreContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  topThreeScore: {
    fontSize: 16,
    fontWeight: "bold" as const,
    color: "#333",
    marginRight: 4,
  },
});

export default TopThree;