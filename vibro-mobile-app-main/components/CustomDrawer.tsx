import { logoutRequest } from "@/Redux/reducer/auth/authSlice";
import { RootState } from "@/Redux/reducer/rootReducer";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
} from "@react-navigation/drawer";
import React, { memo, useCallback } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useDispatch, useSelector } from "react-redux";
import ReactIcon from "../assets/images/react-logo.png";

// Define types for better type safety
interface DrawerItemConfig {
  label: string;
  iconName: string;
  onPress: () => void;
}

interface UserProfile {
  name: string;
  company: string;
  organizationId: number | null;
  phone: string;
  avatar: any;
}

const CustomDrawer: React.FC<DrawerContentComponentProps> = memo((props) => {
  const dispatch = useDispatch();
  // User profile data - could come from props or context
  const user = useSelector((state: RootState) => state.user);
  const userProfile: UserProfile = {
    name: user.first_name,
    company: user.organization || "",
    organizationId: user.organizationId,
    phone: user.phone,
    avatar: ReactIcon,
  };

  // Memoized drawer items configuration
  const drawerItems: DrawerItemConfig[] = [
    {
      label: "Completed Tasks",
      iconName: "check-circle",
      onPress: () =>
        props.navigation.navigate("screens/CompletedTasks/completed-tasks"),
    },
    {
      label: "Sent Messages",
      iconName: "send",
      onPress: () =>
        props.navigation.navigate("screens/Sentmessage/sentmessage"),
    },
    {
      label: "Bookmarks",
      iconName: "bookmark",
      onPress: () => props.navigation.navigate("screens/Bookmarks/bookmarks"),
    },
    {
      label: "Leaderboard",
      iconName: "bar-chart",
      onPress: () =>
        props.navigation.navigate("screens/Leaderboard/leaderboard"),
    },
    {
      label: "Admin and Settings",
      iconName: "settings",
      onPress: () => props.navigation.navigate("screens/Settings/settings"),
    },
    {
      label: "Search",
      iconName: "search",
      onPress: () => props.navigation.navigate("screens/Search/search"),
    },
  ];

  // Memoized callbacks
  const handleAddAccount = useCallback(() => {
    props.navigation.navigate("screens/Login/login");
    // Add your navigation or action logic here
  }, []);

  const renderIcon = useCallback((iconName: string) => {
    const IconRenderer = ({ color, size }: { color: string; size: number }) => (
      <Icon name={iconName} color={color} size={size} />
    );
    IconRenderer.displayName = `DrawerIcon-${iconName}`;
    return IconRenderer;
  }, []);

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Section */}
      <View className="flex flex-row  items-center">
        <Image
          source={userProfile.avatar}
          className="w-16 h-16 rounded-full mb-2 "
          resizeMode="cover"
        />
        <View className="">
          <Text className="text-black text-base font-bold mb-0.5">
            {userProfile.name}
          </Text>
          <Text className="text-black text-sm mb-0.5">
            {userProfile.company}
          </Text>
          {userProfile.organizationId && (
            <Text className="text-black text-xs mb-0.5">
              Org ID: {userProfile.organizationId}
            </Text>
          )}
          <Text className="text-black text-xs">{userProfile.phone}</Text>
        </View>
      </View>

      {/* Drawer Items */}
      <View className="p-1">
        {drawerItems.map((item, index) => (
          <DrawerItem
            key={`${item.label}-${index}`}
            label={item.label}
            icon={renderIcon(item.iconName)}
            onPress={item.onPress}
            activeTintColor="#2662f0"
            inactiveTintColor="#666"
          />
        ))}
      </View>

      {/* Add Account Section */}
      <View className="border-t border-gray-300 px-4 py-3">
        <Text className="text-gray-500 text-sm mb-2">Account</Text>
        <TouchableOpacity
          className="flex-row items-center py-1"
          onPress={handleAddAccount}
          activeOpacity={0.7}
        >
          <Icon name="add" size={24} color="#2662f0" />
          <Text className="ml-2 text-purple-800 text-base">Add Account</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />
      <View>
        <TouchableOpacity
          onPress={() => {
            Alert.alert("Logout", "Are you sure you want to logout?", [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Logout",
                onPress: () => dispatch(logoutRequest()),
                style: "destructive",
              },
            ]);
          }}
        >
          <Text>Logout</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
});

CustomDrawer.displayName = "CustomDrawer";

const styles = StyleSheet.create({
  drawerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  drawerHeaderText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  drawerHeaderEmail: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#ccc",
    marginVertical: 10,
  },
  logoutLabel: {
    color: "red",
  },
});

export default CustomDrawer;
