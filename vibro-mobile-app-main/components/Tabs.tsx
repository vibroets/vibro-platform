import React, { useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onTabPress?: (tabKey: string) => void;
  activeTextColor?: string;
  inactiveTextColor?: string;
  indicatorColor?: string;
  textStyle?: object;
  containerStyle?: object;
  tabStyle?: object;
}

const Tabs: React.FC<TabsProps> = ({
  tabs = [],
  activeTab,
  onTabPress,
  activeTextColor = "#007AFF",
  inactiveTextColor = "#888",
  indicatorColor = "#007AFF",
  textStyle = {},
  containerStyle = {},
  tabStyle = {},
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [indicatorPosition] = useState(new Animated.Value(0));

  const windowWidth = Dimensions.get("window").width;
  const tabWidth = windowWidth / tabs.length;

  const handleTabPress = (index: number, tabKey: string) => {
    setActiveIndex(index);
    if (onTabPress) {
      onTabPress(tabKey);
    }
    Animated.spring(indicatorPosition, {
      toValue: index * tabWidth,
      useNativeDriver: true,
    }).start();
  };

  const isActive = (tabKey: string) => {
    return activeTab ? tabKey === activeTab : tabs[activeIndex].key === tabKey;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.tabsContainer}>
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, tabStyle]}
            onPress={() => handleTabPress(index, tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                textStyle,
                {
                  color: isActive(tab.key)
                    ? activeTextColor
                    : inactiveTextColor,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: indicatorColor,
            width: tabWidth,
            transform: [{ translateX: indicatorPosition }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  tab: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
  },
  indicator: {
    height: 2,
    position: "absolute",
    bottom: 0,
  },
});

export default Tabs;
