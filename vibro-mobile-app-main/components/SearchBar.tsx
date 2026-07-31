import React, { useEffect, useState } from "react";
import {
  Animated,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  Pressable,
  View,
  ViewStyle,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onClear?: () => void;
  debounceTime?: number;
  showCancel?: boolean;
  cancelText?: string;
  onCancel?: () => void;
  iconColor?: string;
  borderColor?: string;
  activeBorderColor?: string;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  cancelStyle?: ViewStyle;
  cancelTextStyle?: TextStyle;
  iconSize?: number;
  autoFocus?: boolean;
  searchIconName?: string;
  clearIconName?: string;
  borderRadius?: number;
  height?: number;
}

const SearchBar: React.FC<SearchBarProps & TextInputProps> = ({
  placeholder = "Search...",
  onSearch,
  onClear,
  debounceTime = 300,
  showCancel = false,
  cancelText = "Cancel",
  onCancel,
  iconColor = "#888",
  borderColor = "#ccc",
  activeBorderColor = "#007AFF",
  style,
  inputStyle,
  cancelStyle,
  cancelTextStyle,
  iconSize = 20,
  autoFocus = false,
  searchIconName = "search",
  clearIconName = "close",
  borderRadius = 8,
  height = 48,
  ...props
}) => {
  const [searchText, setSearchText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const cancelAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (onSearch) {
        onSearch(searchText);
      }
    }, debounceTime);

    return () => clearTimeout(debounceTimer);
  }, [searchText, debounceTime, onSearch]);

  const handleClear = () => {
    setSearchText("");
    if (onClear) {
      onClear();
    }
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    setSearchText("");
    if (onCancel) {
      onCancel();
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (showCancel) {
      Animated.timing(cancelAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!searchText && showCancel) {
      Animated.timing(cancelAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const cancelButtonWidth = cancelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 80],
  });

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.searchContainer,
          {
            borderColor: isFocused ? activeBorderColor : borderColor,
            borderRadius,
            height,
          },
        ]}
      >
        <Icon
          name={searchIconName}
          size={iconSize}
          color={isFocused ? activeBorderColor : iconColor}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.input, inputStyle, { height }]}
          placeholder={placeholder}
          placeholderTextColor="#888"
          value={searchText}
          onChangeText={setSearchText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoFocus={autoFocus}
          returnKeyType="search"
          underlineColorAndroid="transparent"
          {...props}
        />
        {searchText ? (
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [
              styles.clearButton,
              pressed && styles.clearButtonPressed,
            ]}
          >
            {({ pressed }) => (
              <Icon
                name={clearIconName}
                size={iconSize}
                color={
                  pressed
                    ? activeBorderColor
                    : isFocused
                    ? activeBorderColor
                    : iconColor
                }
              />
            )}
          </Pressable>
        ) : null}
      </View>
      {showCancel && (
        <Animated.View style={{ width: cancelButtonWidth, overflow: "hidden" }}>
          <TouchableOpacity
            onPress={handleCancel}
            style={[styles.cancelButton, cancelStyle]}
          >
            <Text style={[styles.cancelText, cancelTextStyle]}>
              {cancelText}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    // paddingHorizontal: 16,
    // paddingVertical: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
    borderRadius: 12,
  },
  clearButtonPressed: {
    backgroundColor: "#E5E7EB",
  },
  cancelButton: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 12,
    height: "100%",
  },
  cancelText: {
    color: "#007AFF",
    fontSize: 16,
  },
});

export default SearchBar;
