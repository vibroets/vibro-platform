import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import Home from "../../screens/home/home";

const Index = () => {
  return (
    <SafeAreaView style={styles.container}>
      <Home />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa', // bg-neutral-50
  },
});

export default Index;
