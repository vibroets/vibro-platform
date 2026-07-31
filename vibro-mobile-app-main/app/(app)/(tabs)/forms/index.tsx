/* eslint-disable react-hooks/rules-of-hooks */
import SearchBar from "@/components/SearchBar";
import { TABS } from "@/constants/forms";
import React, { useState } from "react";
import { Keyboard, StyleSheet, TouchableWithoutFeedback, View } from "react-native";
import FormsTabs from "./forms-tabs";

const Forms = () => {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleSubmitSearch = ({
    nativeEvent,
  }: {
    nativeEvent: { text: string };
  }) => {
    handleSearch(nativeEvent.text);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* <Header title={"Forms"} /> */}
        <SearchBar
          placeholder="Search"
          onSearch={handleSearch}
          onSubmitEditing={handleSubmitSearch}
        />
        <FormsTabs searchQuery={searchQuery} />
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
});

export default Forms;
