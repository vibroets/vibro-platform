import { AnnouncementItem, fetchAnnouncements, patchAnnouncement } from "@/Redux/reducer/announcements/announcementsSlice";
import { RootState } from "@/Redux/reducer/rootReducer";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useDispatch, useSelector } from "react-redux";
import Cards from "./Cards";

const Home = () => {
  const data = useSelector((state: RootState) => state.announcements.announcements);
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState("");
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
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 16, color: '#111827' },
  clearButton: {
    paddingLeft: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clearButtonPressed: {
    backgroundColor: "#E5E7EB",
  },
  listContainer: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  emptyListText: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});

export default Home;

