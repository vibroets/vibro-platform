// src/styles/commonStyles.ts

import { Platform, StatusBar, StyleSheet } from 'react-native';

const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    backgroundColor: "#3B82F6", // Primary color
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    ...Platform.select({
      android: {
        paddingTop: StatusBar.currentHeight,
      },
    }),
  },
  backButton: {
    marginRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap:10
  },
  headerTitle: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#fff",
    elevation: 3, // Android shadow
    shadowColor: "#000", // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937", // neutral-800
  },
  content: {
    marginTop: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    color: "#bfdbff", // secondary color
    fontWeight: "bold",
  },
});

export default commonStyles;
