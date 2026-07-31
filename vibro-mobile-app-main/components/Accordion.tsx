import React, { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface AccordionProps {
  title: string | React.ReactNode;
  titleStyle?: StyleProp<TextStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  headerRight?: React.ReactNode;
  iconColor?: string;
  iconSize?: number;
  expanded?: boolean;
  onPress?: (isExpanded: boolean) => void;
  children: React.ReactNode;
}

const Accordion: React.FC<AccordionProps> = ({
  title,
  titleStyle,
  headerStyle,
  contentStyle,
  containerStyle,
  headerRight,
  iconColor = "#333",
  iconSize = 24,
  expanded = false,
  onPress,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [animation] = useState(new Animated.Value(expanded ? 1 : 0));

  useEffect(() => {
    if (expanded === isExpanded) return;
    setIsExpanded(expanded);
    Animated.timing(animation, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start();
  }, [expanded, isExpanded, animation]);

  const toggleAccordion = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);

    Animated.timing(animation, {
      toValue,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start();

    if (onPress) {
      onPress(!isExpanded);
    }
  };

  const rotateInterpolation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const heightInterpolation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1], // Will be multiplied by content height
  });

  return (
    <View style={[styles.container, containerStyle]}>
      <TouchableOpacity
        style={[styles.header, headerStyle]}
        onPress={toggleAccordion}
        activeOpacity={0.8}
      >
        {typeof title === "string" ? (
          <Text style={[styles.title, titleStyle]}>{title}</Text>
        ) : (
          <View style={styles.titleNodeWrap}>{title}</View>
        )}
        <View style={styles.headerRightWrap}>
          {headerRight}
          <Animated.View style={{ transform: [{ rotate: rotateInterpolation }] }}>
            <Icon name="keyboard-arrow-down" size={iconSize} color={iconColor} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.contentContainer,
          contentStyle,
          {
            maxHeight: heightInterpolation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 10000],
            }),
            opacity: animation,
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginVertical: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f8f8f8",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  contentContainer: {
    overflow: "hidden",
  },
  headerRightWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleNodeWrap: {
    flex: 1,
  },
});

export default Accordion;
