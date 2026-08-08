import React from "react";
import {
  StatusBar,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import styles from "@/styles/commonStyles";
import KeyboardAwareContainer from "@/components/KeyboardAwareContainer";

const CompletedTasks = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={styles.header.backgroundColor}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" color="#fff" size={20} />
          <Text style={styles.headerTitle}>Completed Tasks Screen</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareContainer
        contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-start" }}
        autoScrollOffset={200}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20}
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon
            name="search"
            size={20}
            color="#9CA3AF"
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search"
            style={styles.searchInput}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Completed Tasks Screen!</Text>
        </View>
        {/* <View>
          <View style={taskStyle.darkMode}>
            <Text style={taskStyle.darkModeText}>
              Style inheritance <Text style={taskStyle.boldText}> BoldText</Text>
            </Text>
          </View>
          <View
            style={[taskStyle.box, taskStyle.lightGreenBg, taskStyle.boxShadow]}
          >
            <Text>Light Green</Text>
          </View>
          <View
            style={[
              taskStyle.box,
              taskStyle.lightBlueBg,
              taskStyle.androidShadow,
            ]}
          >
            <Text>light Blue</Text>
          </View>
        </View> */}
      </KeyboardAwareContainer>
    </SafeAreaView>
  );
};

const taskStyle = StyleSheet.create({
  box: {
    height: 250,
    width: 250,
    paddingHorizontal: 10,
    paddingVertical: 20,
    marginVertical: 10,
    borderWidth: 10,
    borderColor: "red",
    borderRadius: 5,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  lightGreenBg: {
    backgroundColor: "lightgreen",
  },
  lightBlueBg: {
    backgroundColor: "lightblue",
  },
  boxShadow: {
    // shadowColor: "#333333",
    // shadowOffset: {
    //   width: 6,
    //   height: 6,
    // },
    // shadowOpacity: 0.6,
    // shadowRadius: 4,
  },
  androidShadow: {
    elevation: 10,
    shadowColor: "#333333",
  },
  darkMode: {
    backgroundColor: "black",
  },
  darkModeText: {
    color: "white",
  },
  boldText: {
    fontWeight: "bold",
  },
});

export default CompletedTasks;
