import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { typography } from "../../styles/typography";

interface ValidationErrorBannerProps {
  errorCount: number;
  visible: boolean;
  onPress: () => void;
  onClose?: () => void;
  currentErrorIndex?: number;
  totalErrors?: number;
}

const ValidationErrorBanner: React.FC<ValidationErrorBannerProps> = ({
  errorCount,
  visible,
  onPress,
  onClose,
  currentErrorIndex,
  totalErrors,
}) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(animatedValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, animatedValue]);

  if (!visible) return null;

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 0],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Use totalErrors if available (from errorFieldKeys), otherwise fall back to errorCount
  const displayCount = (totalErrors !== undefined && totalErrors > 0) ? totalErrors : errorCount;
  const friendlyText = displayCount === 1
    ? "1 required field is missing."
    : `${displayCount} required fields are missing.`;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.banner}>
        <TouchableOpacity
          style={styles.mainTouchable}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <MaterialIcons name="info-outline" size={22} color="#E53935" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.messageText}>{friendlyText}</Text>
            <Text style={styles.tapText}>Tap here to view</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color="#E53935" />
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity
            style={styles.closeTouchable}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={20} color="#E53935" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFE5E5",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFB3B3",
  },
  mainTouchable: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  closeTouchable: {
    padding: 4,
    marginLeft: 8,
  },
  iconContainer: {
    marginRight: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFD6D6",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  messageText: {
    ...typography.labelMedium,
    color: "#C62828",
    marginBottom: 2,
  },
  tapText: {
    ...typography.labelSmall,
    color: "#E53935",
  },
});

export default ValidationErrorBanner;
