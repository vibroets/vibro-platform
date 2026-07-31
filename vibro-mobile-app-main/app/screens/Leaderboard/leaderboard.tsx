import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from "react-native";
import React from "react";
import styles from "@/styles/commonStyles";
import { useNavigation } from "expo-router";
import Icon from "react-native-vector-icons/MaterialIcons";
import TopThree from "./TopThree";
import LeaderboardItem from "./LeaderBoardItem";

interface LeaderboardUser {
  id: number;
  name: string;
  score: number;
  position: number;
  subtitle?: string;
  avatar: any; // Consider using ImageSourcePropType for better type safety
}

const Leaderboard = () => {
  const navigation = useNavigation();

  const leaderboardData: LeaderboardUser[] = [
    {
      id: 1,
      name: "ANIKESH YADAV",
      score: 560,
      position: 1,
      avatar: require("@/assets/images/icon.png"),
    },
    {
      id: 2,
      name: "Vaishnavi Vaishnavi",
      score: 540,
      position: 2,
      avatar: require("@/assets/images/icon.png"),
    },
    {
      id: 3,
      name: "Aakash Kumar",
      score: 430,
      position: 3,
      avatar: require("@/assets/images/icon.png"),
    },
    {
      id: 4,
      name: "KHUSHAL KHUSHAL",
      score: 420,
      position: 4,
      subtitle: "CF_Partner",
      avatar: require("@/assets/images/icon.png"),
    },
    {
      id: 5,
      name: "Swetha mohan",
      score: 400,
      position: 5,
      subtitle: "Cafe Partner",
      avatar: require("@/assets/images/icon.png"),
    },
    {
      id: 6,
      name: "Anshu Kumar",
      score: 360,
      position: 6,
      subtitle: "Cafe Partner",
      avatar: require("@/assets/images/icon.png"),
    },
    {
      id: 7,
      name: "Harpreet Singh",
      score: 360,
      position: 7,
      subtitle: "Cafe Partner",
      avatar: require("@/assets/images/icon.png"),
    },
    {
      id: 8,
      name: "Satyaprakash Paswan",
      score: 340,
      position: 8,
      subtitle: "Cafe Partner",
      avatar: require("@/assets/images/icon.png"),
    },
    {
      id: 9,
      name: "Harsh Harsh",
      score: 320,
      position: 9,
      subtitle: "Cafe Partner",
      avatar: require("@/assets/images/icon.png"),
    },
    {
      id: 10,
      name: "Mohit Dayal",
      score: 310,
      position: 10,
      subtitle: "Cafe Partner",
      avatar: require("@/assets/images/icon.png"),
    },
  ];


  return (
    <SafeAreaView style={leaderboardStyles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={styles.header.backgroundColor}
      />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" color="#fff" size={20} />
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </TouchableOpacity>
      </View>

      <View>
        {/* Top 3 podium */}
        <TopThree users={leaderboardData}/>
      </View>

      <ScrollView
        style={leaderboardStyles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Rest of the leaderboard */}
        <View style={leaderboardStyles.listContainer}>
          {leaderboardData
            .slice(3)
            .map((user, index) => <LeaderboardItem user={user} key={index}/>)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const leaderboardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    backgroundColor: "#6B46C1",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  backButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600" as const,
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  listContainer: {
    backgroundColor: "#fff",
    marginTop: 8,
    paddingVertical: 8,
  },
  position: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#666",
    width: 24,
    textAlign: "center" as const,
  },
  score: {
    fontSize: 16,
    fontWeight: "bold" as const,
    color: "#333",
    marginRight: 4,
  },
});

export default Leaderboard;
