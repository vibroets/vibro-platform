import { RootState } from "@/Redux/reducer/rootReducer";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BellIcon,
  BookmarkIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CogIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PlusIcon,
} from "react-native-heroicons/outline";
import { useSelector } from "react-redux";

const Sidebar = (props: DrawerContentComponentProps) => {
  const { navigation } = props;
  const user = useSelector((state: RootState) => state.user);

  const menuItems = [
    {
      id: 1,
      title: "Completed Tasks",
      icon: CheckCircleIcon,
      onPress: () => console.log("Completed Tasks"), // replace with navigation.navigate()
    },
    {
      id: 2,
      title: "Sent Messages",
      icon: PaperAirplaneIcon,
    },
    {
      id: 3,
      title: "Bookmarks",
      icon: BookmarkIcon,
    },
    {
      id: 4,
      title: "Leaderboard",
      icon: ChartBarIcon,
    },
    {
      id: 5,
      title: "Admin and Settings",
      icon: CogIcon,
    },
    {
      id: 6,
      title: "Search",
      icon: MagnifyingGlassIcon,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar backgroundColor="#6b46c1" barStyle="light-content" />

      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarInner}>
              <View style={styles.avatarDots}>
                {/* Avatar dots */}
                {new Array(8).fill(0).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.avatarDot,
                      { backgroundColor: i % 3 === 0 ? "#000000" : "#ffffff" },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.first_name}</Text>
            <Text style={styles.userCompany}>{user.organization}</Text>
            {user.organizationId && (
              <Text style={styles.userPhone}>Org ID: {user.organizationId}</Text>
            )}
            <Text style={styles.userPhone}>{user.phone}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.bellButton}>
          <BellIcon size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Menu Items */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                item.onPress?.();
                navigation.closeDrawer(); // close after selecting
              }}
              style={styles.menuItem}
            >
              <View style={styles.menuIconContainer}>
                <item.icon size={24} color="#374151" strokeWidth={1.5} />
              </View>
              <Text style={styles.menuText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Account Section */}
        <View style={styles.accountSection}>
          <Text style={styles.accountTitle}>Account</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <PlusIcon size={24} color="#6b46c1" strokeWidth={2} />
            </View>
            <Text style={styles.addAccountText}>Add Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Version Info */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>r121 v5.37.1</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    backgroundColor: "#6b46c1", // bg-purple
    paddingHorizontal: 24,
    paddingVertical: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    backgroundColor: "#ffffff",
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatarInner: {
    width: 48,
    height: 48,
    backgroundColor: "#000000",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarDots: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 32,
    height: 32,
  },
  avatarDot: {
    width: 8,
    height: 8,
    margin: 2,
    borderRadius: 2,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  userCompany: {
    color: "#ffffff",
    fontSize: 14,
    opacity: 0.9,
  },
  userPhone: {
    color: "#ffffff",
    fontSize: 14,
    opacity: 0.9,
  },
  bellButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  menuContainer: {
    paddingVertical: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  menuText: {
    color: "#333333", // text-darkGray
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  accountSection: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb", // border-gray-200
    marginTop: 16,
  },
  accountTitle: {
    color: "#666666", // text-gray
    fontSize: 14,
    fontWeight: "500",
    paddingHorizontal: 24,
    paddingVertical: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addAccountText: {
    color: "#6b46c1", // text-purple
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  versionContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb", // border-gray-200
  },
  versionText: {
    color: "#ef4444", // text-red-500
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});

export default Sidebar;
