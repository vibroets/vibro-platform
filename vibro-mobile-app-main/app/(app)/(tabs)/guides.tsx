import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Header } from "../../../components/Header"; // Adjust path if needed

const Guides = () => {
  return (
    <>
      {/* <Header title="Guides" /> */}
      <View style={styles.container}>
        <Text style={styles.guidesText}>Guides!</Text>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guidesText: {
    fontSize: 48, // text-5xl equivalent
    color: '#BFDBFE', // text-secondary
    fontWeight: 'bold',
  },
});

export default Guides;
