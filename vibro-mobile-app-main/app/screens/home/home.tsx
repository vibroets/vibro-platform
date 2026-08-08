import { AnnouncementItem, fetchAnnouncements, patchAnnouncement } from "@/Redux/reducer/announcements/announcementsSlice";
import { RootState } from "@/Redux/reducer/rootReducer";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, Pressable, RefreshControl, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useDispatch, useSelector } from "react-redux";
import Cards from "./Cards";

const Home = () => {
  const data = useSelector((state: RootState) => state.announcements.announcements);
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // --- EFFECT: Fetch announcements on load ---
  useEffect(() => {
    dispatch(fetchAnnouncements());
  }, [dispatch]);

  // --- EFFECT: Re-evaluate expiry every minute while screen is open ---
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // --- HANDLERS ---
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await dispatch(fetchAnnouncements() as any); } catch {}
    setRefreshing(false);
  }, [dispatch]);

  const handleLike = (id: number, currentStatus: boolean) => {
    dispatch(patchAnnouncement({ id, type: "liked", value: !currentStatus }));
  };

  const handleAcknowledge = (id: number) => {
    dispatch(patchAnnouncement({ id, type: "acknowledged", value: true }));
  };

  const handleView = (id: number) => {
    // Only call API if it hasn't been viewed yet to save bandwidth
    const item = data.find(i => i.id === id);
    if (item && !item.viewed) {
      dispatch(patchAnnouncement({ id, type: "viewed", value: true }));
    }
    router.push({ pathname: '/announcement-detail', params: { id } });
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Filter and sort for Main List (only active announcements are shown)
  const filteredData = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const activeData = data.filter((item: AnnouncementItem) => {
      const start = item.announcement_start_date ? new Date(item.announcement_start_date) : new Date(0);
      const end = item.announcement_end_date ? new Date(item.announcement_end_date) : new Date(8640000000000000);
      const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      return startDate <= today && endDate >= today;
    });

    const filtered = !normalizedQuery
      ? activeData
      : activeData.filter((item) =>
          (item.title ?? "").toLowerCase().includes(normalizedQuery)
        );

    return [...filtered].sort((a, b) => {
      // Pinned items first (true > false), then by id ascending
      if (b.pin_as_important && !a.pin_as_important) return 1;
      if (!b.pin_as_important && a.pin_as_important) return -1;
      // Both same pin status, sort by id
      return a.id - b.id;
    });
  }, [data, normalizedQuery, now]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => setSearchQuery("")}
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.clearButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              {({ pressed }) => (
                <Icon name="close" size={18} color={pressed ? "#111827" : "#9CA3AF"} />
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Main Content List */}
        <View style={styles.listContainer}>
          <FlatList
            ref={flatListRef}
            contentContainerStyle={{ paddingBottom: 30 }}
            data={filteredData}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#2563EB"]} tintColor="#2563EB" />
            }
            ListHeaderComponent={
              <Text style={styles.sectionTitle}>Announcements</Text>
            }
            renderItem={({ item }) => (
              <Cards
                  item={item}
                  onLike={handleLike}
                  onAcknowledge={handleAcknowledge}
                  onView={handleView}
              />
            )}
            ListEmptyComponent={
              <Text style={styles.emptyListText}>No items found</Text>
            }
            // Optimization for scrollToIndex
            onScrollToIndexFailed={info => {
              const wait = new Promise(resolve => setTimeout(resolve, 500));
              wait.then(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
              });
            }}
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  // General Styles
  searchContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 10,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  clearButton: {
    paddingLeft: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clearButtonPressed: {
    backgroundColor: "#E5E7EB",
  },
  listContainer: { flex: 1, paddingHorizontal: 10 },
  sectionTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  emptyListText: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 14 },
});

export default Home;

