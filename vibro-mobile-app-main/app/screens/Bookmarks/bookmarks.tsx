import { View, Text, StatusBar, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React from "react";
import styles from "@/styles/commonStyles";
import Icon  from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "expo-router";

const Bookmarks = () => {

  const navigation = useNavigation()
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <StatusBar
        barStyle={"light-content"}
        backgroundColor={styles.header.backgroundColor}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" color="#fff" size={20} />
          <Text style={styles.headerTitle}>BookMarks</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Bookmarks;
