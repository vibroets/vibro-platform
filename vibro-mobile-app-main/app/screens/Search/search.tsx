import React from 'react'
import { Text, View, StyleSheet } from 'react-native'

const Search = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.searchText}>Search!</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchText: {
    fontSize: 48, // text-5xl equivalent
    color: '#BFDBFE', // text-secondary
    fontWeight: 'bold',
  },
});

export default Search