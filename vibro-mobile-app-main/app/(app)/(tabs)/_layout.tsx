import React, { useState, useEffect } from "react";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { withLayoutContext } from "expo-router";
import { Keyboard } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { Navigator: TopTabNavigator, Screen: TopTabScreen } = createMaterialTopTabNavigator();
const MaterialTabs = withLayoutContext(TopTabNavigator);

const _layout = () => {
  const [tabBarVisible, setTabBarVisible] = useState(true);
  const insets = useSafeAreaInsets();

  // Disable tab bar hide/show to prevent layout glitches that cause padding animations
  // The tab bar will remain visible at all times when using forms
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setTabBarVisible(false);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setTabBarVisible(true);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <MaterialTabs
      screenOptions={{
        swipeEnabled: false,
        tabBarIndicatorStyle: { backgroundColor: "#D1D5DB" },
        tabBarStyle: tabBarVisible ? {
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          paddingBottom: insets.bottom,
          height: 56 + insets.bottom,
        } : { display: 'none' },
        tabBarShowLabel: true,
        tabBarShowIcon: true,
        tabBarLabelStyle: { fontSize: 9, textTransform: "none" },
        tabBarIconStyle: { marginBottom: 2 },
      }}
      tabBarPosition="bottom"
    >
      <MaterialTabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Icon
              name="home"
              size={20}
              color={focused ? "#2563EB" : "#9CA3AF"}
            />
          ),
          tabBarActiveTintColor: "#2563EB",
        }}
      />
      <MaterialTabs.Screen
        name="polls"
        options={{
          title: "Polls",
          headerShown: false,
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Icon
              name="poll"
              size={20}
              color={focused ? "#7C3AED" : "#9CA3AF"}
            />
          ),
          tabBarActiveTintColor: "#7C3AED",
        }}
      />
      <MaterialTabs.Screen
        name="forms"
        options={{
          title: "Forms",
          headerShown: false,
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Icon
              name="assignment"
              size={20}
              color={focused ? "#0D9488" : "#9CA3AF"}
            />
          ),
          tabBarActiveTintColor: "#0D9488",
        }}
      />
      <MaterialTabs.Screen
        name="planner"
        options={{
          title: "Plans",
          headerShown: false,
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Icon
              name="event-note"
              size={20}
              color={focused ? "#4F46E5" : "#9CA3AF"}
            />
          ),
          tabBarActiveTintColor: "#4F46E5",
        }}
      />
      <MaterialTabs.Screen
        name="todo"
        options={{
          title: "To-Do",
          headerShown: false,
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Icon
              name="check-circle-outline"
              size={20}
              color={focused ? "#EA580C" : "#9CA3AF"}
            />
          ),
          tabBarActiveTintColor: "#EA580C",
        }}
      />
      <MaterialTabs.Screen
        name="learn"
        options={{
          title: "Learn",
          headerShown: false,
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Icon
              name="school"
              size={20}
              color={focused ? "#059669" : "#9CA3AF"}
            />
          ),
          tabBarActiveTintColor: "#059669",
        }}
      />
      <MaterialTabs.Screen
        name="guides"
        options={{
          title: "Guides",
          headerShown: false,
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Icon
              name="menu-book"
              size={20}
              color={focused ? "#E11D48" : "#9CA3AF"}
            />
          ),
          tabBarActiveTintColor: "#E11D48",
        }}
      />
    </MaterialTabs>
  );
};

export default _layout;
