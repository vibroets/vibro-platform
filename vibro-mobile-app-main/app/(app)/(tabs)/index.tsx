import React from "react";
import { StyleSheet, View } from "react-native";
import Home from "../../screens/home/home";

const Index = () => {
  return (
    <View style={styles.container}>
      <Home />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa', // bg-neutral-50
  },
});

export default Index;
