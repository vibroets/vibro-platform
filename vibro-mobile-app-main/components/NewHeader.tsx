import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import Icon from "react-native-vector-icons/MaterialIcons";

interface HeaderProps {
  title: string;
  showBack?: boolean;
  showNotification?: boolean;
  onMenuPress?: () => void;
  onBackPress?: () => void;
  onNotificationPress?: () => void;
}

type RootDrawerParamList = {
  "(tabs)": undefined;
};

export const Header: React.FC<HeaderProps> = ({
  title,
  onBackPress,
  showNotification = true,
  showBack = false,
}) => {
  const navigation = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />
      <View style={styles.container}>
        {showBack ? (
          <TouchableOpacity onPress={onBackPress} style={styles.iconButton}>
            <Icon name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            style={styles.iconButton}
          >
            <Ionicons name="menu" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}

        <View style={styles.titleWrapper}>
          <Text style={styles.title}>{title}</Text>
        </View>

        {showNotification ? (
          <TouchableOpacity
            onPress={() => router.push("/(app)/screens/Notification/notification")}
            style={styles.iconButton}
          >
            <Ionicons name="notifications-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconButton} /> // empty view to balance layout
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#2563EB",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: "#2563EB",
    position: "relative",
  },
  iconButton: {
    padding: 8,
    zIndex: 1, // ensure it's tappable
  },
  titleWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
  },
});
