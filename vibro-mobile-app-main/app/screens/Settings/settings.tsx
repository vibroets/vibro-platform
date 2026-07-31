import { View, Text, StyleSheet } from 'react-native'
import React from 'react'

const Settings = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.settingsText}>Settings!</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsText: {
    fontSize: 48, // text-5xl equivalent
    color: '#BFDBFE', // text-secondary
    fontWeight: 'bold',
  },
});

export default Settings