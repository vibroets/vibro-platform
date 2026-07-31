import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DraftsForm from "./tabs-forms/drafts-form";
import NewForm from "./tabs-forms/new-form";
import ReceivedForm from "./tabs-forms/received-form";
import SentForm from "./tabs-forms/sent-form";

type FormsTabsProps = {
  searchQuery: string;
};

type FormsTabKey = "new" | "drafts" | "sent" | "received";

const FormsTabs = ({ searchQuery }: FormsTabsProps) => {
  const params = useLocalSearchParams() as { tab?: string };
  const [activeTab, setActiveTab] = useState<FormsTabKey>("new");

  const tabIndexByKey: Record<FormsTabKey, number> = {
    new: 0,
    drafts: 1,
    sent: 2,
    received: 3,
  };

  useEffect(() => {
    const requestedTab = typeof params.tab === "string" ? params.tab.toLowerCase() : "";
    const tabKeys = Object.keys(tabIndexByKey) as FormsTabKey[];
    const matchedKey = tabKeys.find((key) => key === requestedTab);
    if (matchedKey && matchedKey !== activeTab) {
      setActiveTab(matchedKey);
    }
  }, [params.tab, activeTab]);

  const switchTab = (tab: FormsTabKey) => {
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "new":
        return <NewForm searchQuery={searchQuery} />;
      case "drafts":
        return <DraftsForm />;
      case "sent":
        return <SentForm searchQuery={searchQuery} />;
      case "received":
        return <ReceivedForm />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        <TouchableTab
          label="NEW"
          active={activeTab === "new"}
          onPress={() => switchTab("new")}
        />
        <TouchableTab
          label="DRAFTS"
          active={activeTab === "drafts"}
          onPress={() => switchTab("drafts")}
        />
        <TouchableTab
          label="SENT"
          active={activeTab === "sent"}
          onPress={() => switchTab("sent")}
        />
        <TouchableTab
          label="RECEIVED"
          active={activeTab === "received"}
          onPress={() => switchTab("received")}
        />
      </View>
      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
};

function TouchableTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabWrap, active ? styles.tabWrapActive : null]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    backgroundColor: "#fff",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  content: {
    flex: 1,
  },
  tabWrap: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    alignItems: "center",
  },
  tabWrapActive: {
    borderBottomColor: "#FF5733",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#000",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: "#FF5733",
  },
});

export default FormsTabs;
