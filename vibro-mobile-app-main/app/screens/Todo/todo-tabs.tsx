import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { TabBar, TabView } from "react-native-tab-view";
import DraftTodo from "./tabs-todo/draft-todo";
import NewTodo from "./tabs-todo/new-todo";
import ReceiveTodo from "./tabs-todo/receive-todo";
import SentTodo from "./tabs-todo/sent-todo";

interface SelectedForm {
  formId: string;
  taskId: string;
  submissionId?: string;
  formTitle?: string;
  formType?: string;
  sourceScreen?: string;
}

export interface TodoFilters {
  query: string;
  startDate: Date | null;
  endDate: Date | null;
  status: ("all" | "not_started" | "pending")[];
  location: string[];
  mainForm: string[];
  formType: ("all" | "standard" | "audit")[];
  taskType: ("all" | "normal" | "followup")[];
  taskId: string[];
  responseId: string[];
  question: string[];
  reopened: boolean;
  aging: "all" | "today" | "1-7" | "8-30" | "30+";
  sort: "default" | "newest" | "oldest" | "az";
}

interface TodoTabsProps {
  onFormSelect?: (formData: SelectedForm) => void;
  initialTabIndex?: number;
  onTabChange?: (index: number) => void;
  filters?: TodoFilters;
  draftFilters?: TodoFilters;
  onLocationOptionsChange?: (tabKey: string, options: string[]) => void;
  onMainFormOptionsChange?: (tabKey: string, options: string[]) => void;
  onTaskIdOptionsChange?: (tabKey: string, options: string[]) => void;
  onResponseIdOptionsChange?: (tabKey: string, options: string[]) => void;
  onQuestionOptionsChange?: (tabKey: string, options: string[]) => void;
}

const TodoTabs = ({
  onFormSelect,
  initialTabIndex = 0,
  onTabChange,
  filters,
  draftFilters,
  onLocationOptionsChange,
  onMainFormOptionsChange,
  onTaskIdOptionsChange,
  onResponseIdOptionsChange,
  onQuestionOptionsChange,
}: TodoTabsProps) => {
  const layout = useWindowDimensions();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  
  // Determine initial index based on tab parameter
  const getInitialIndex = () => {
    if (tab === 'sent') return 2; // SENT tab index
    if (tab === 'draft') return 1; // DRAFTS tab index
    if (tab === 'receive') return 3; // RECEIVED tab index
    return initialTabIndex;
  };

  const [index, setIndex] = useState(getInitialIndex());
  const [routes] = useState([
    { key: "new", title: "NEW" },
    { key: "draft", title: "DRAFTS" },
    { key: "sent", title: "SENT" },
    { key: "receive", title: "RECEIVED" },
  ]);

  const renderScene = ({ route }: any) => {
    switch (route.key) {
      case 'new':
        return (
          <NewTodo
            onFormSelect={onFormSelect}
            filters={filters}
            draftFilters={draftFilters}
            onLocationOptionsChange={(options) =>
              onLocationOptionsChange?.("new", options)
            }
            onMainFormOptionsChange={(options) =>
              onMainFormOptionsChange?.("new", options)
            }
            onTaskIdOptionsChange={(options) =>
              onTaskIdOptionsChange?.("new", options)
            }
            onResponseIdOptionsChange={(options) =>
              onResponseIdOptionsChange?.("new", options)
            }
            onQuestionOptionsChange={(options) =>
              onQuestionOptionsChange?.("new", options)
            }
          />
        );
      case 'draft':
        return (
          <DraftTodo
            onFormSelect={onFormSelect}
            filters={filters}
            draftFilters={draftFilters}
            onLocationOptionsChange={(options) =>
              onLocationOptionsChange?.("draft", options)
            }
            onMainFormOptionsChange={(options) =>
              onMainFormOptionsChange?.("draft", options)
            }
            onTaskIdOptionsChange={(options) =>
              onTaskIdOptionsChange?.("draft", options)
            }
            onResponseIdOptionsChange={(options) =>
              onResponseIdOptionsChange?.("draft", options)
            }
            onQuestionOptionsChange={(options) =>
              onQuestionOptionsChange?.("draft", options)
            }
          />
        );
      case 'sent':
        return (
          <SentTodo
            onFormSelect={onFormSelect}
            filters={filters}
            draftFilters={draftFilters}
            onLocationOptionsChange={(options) =>
              onLocationOptionsChange?.("sent", options)
            }
            onMainFormOptionsChange={(options) =>
              onMainFormOptionsChange?.("sent", options)
            }
            onTaskIdOptionsChange={(options) =>
              onTaskIdOptionsChange?.("sent", options)
            }
            onResponseIdOptionsChange={(options) =>
              onResponseIdOptionsChange?.("sent", options)
            }
            onQuestionOptionsChange={(options) =>
              onQuestionOptionsChange?.("sent", options)
            }
          />
        );
      case 'receive':
        return (
          <ReceiveTodo
            onFormSelect={onFormSelect}
            filters={filters}
            draftFilters={draftFilters}
            onLocationOptionsChange={(options) =>
              onLocationOptionsChange?.("receive", options)
            }
            onMainFormOptionsChange={(options) =>
              onMainFormOptionsChange?.("receive", options)
            }
            onTaskIdOptionsChange={(options) =>
              onTaskIdOptionsChange?.("receive", options)
            }
            onResponseIdOptionsChange={(options) =>
              onResponseIdOptionsChange?.("receive", options)
            }
            onQuestionOptionsChange={(options) =>
              onQuestionOptionsChange?.("receive", options)
            }
          />
        );
      default:
        return null;
    }
  };

  const handleIndexChange = (newIndex: number) => {
    setIndex(newIndex);
    onTabChange?.(newIndex);
  };

  return (
    <TabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      onIndexChange={handleIndexChange}
      initialLayout={{ width: layout.width }}
      renderTabBar={(props) => (
        <TabBar
          {...props}
          indicatorStyle={{ backgroundColor: "#FF5733" }}
          style={styles.tabBar}
          activeColor="#FF5733"
          inactiveColor="#000"
          scrollEnabled={false}
          tabStyle={styles.tab}
        />
      )}
    />
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#fff",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  tab: {
    paddingHorizontal: 4,
    minWidth: 80,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

export default TodoTabs;
