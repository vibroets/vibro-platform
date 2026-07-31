import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useFocusEffect } from "expo-router";
import api from "../../../services";
import { POLL_MY_POLLS, POLL_SENT, POLL_SUBMIT } from "../../../services/constants";

interface PollQuestion {
  id: number;
  question_text: string;
  question_type: "multiple-choice" | "checkbox" | "rating" | "yes-no" | "text" | "emoji";
  options: any[];
  required: boolean;
}

interface Poll {
  id: number;
  title: string;
  description?: string;
  category: string;
  poll_type: string;
  thumbnail?: string;
  start_date: string;
  end_date: string;
  anonymous: boolean;
  allow_multiple_responses: boolean;
  is_completed: boolean;
  share_id?: number;
  questions: PollQuestion[];
}

interface PollFilters {
  query: string;
  category: string[];
}

const getDefaultFilters = (): PollFilters => ({
  query: "",
  category: [],
});

const PollsScreen = () => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [filteredPolls, setFilteredPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "sent">("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<PollFilters>(getDefaultFilters());
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const categoryOptions = ["Employee Engagement", "Operations", "HR", "Safety", "Training", "Events", "General"];

  const fetchPolls = async () => {
    try {
      const endpoint = activeTab === "sent" ? POLL_SENT : POLL_MY_POLLS;
      const res = await api.get<Poll[]>(endpoint);
      const data = (res.data || []).sort(
        (a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime()
      );
      setPolls(data);
    } catch (error: any) {
      console.error("Error fetching polls:", error);
      Alert.alert("Error", error.message || "Failed to load polls");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPolls();
    }, [activeTab])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPolls();
  };

  useEffect(() => {
    let filtered = [...polls];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q)
      );
    }
    if (filters.category.length > 0) {
      filtered = filtered.filter((p) => filters.category.includes(p.category));
    }
    setFilteredPolls(filtered);
  }, [polls, searchQuery, filters]);

  const toggleCategory = (cat: string) => {
    setFilters((prev) => ({
      ...prev,
      category: prev.category.includes(cat) ? prev.category.filter((c) => c !== cat) : [...prev.category, cat],
    }));
  };

  const openPoll = (poll: Poll) => {
    if (activeTab === "sent" && !poll.allow_multiple_responses) {
      Alert.alert("Submitted", "You have already submitted this poll.");
      return;
    }
    setSelectedPoll(poll);
    setAnswers({});
  };

  const closeModal = () => {
    setSelectedPoll(null);
    setAnswers({});
  };

  const setAnswer = (questionId: number, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const validateAnswers = () => {
    if (!selectedPoll) return false;
    for (const q of selectedPoll.questions || []) {
      if (q.required && (answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === "" || (Array.isArray(answers[q.id]) && answers[q.id].length === 0))) {
        Alert.alert("Required", `Please answer question: ${q.question_text}`);
        return false;
      }
    }
    return true;
  };

  const submitPoll = async () => {
    if (!selectedPoll) return;
    if (!validateAnswers()) return;
    setSubmitting(true);
    try {
      const payload = {
        answers: selectedPoll.questions.map((q) => ({
          question_id: q.id,
          answer: answers[q.id],
        })),
      };
      await api.post(`${POLL_SUBMIT}${selectedPoll.id}/submit/`, payload);
      Alert.alert("Success", "Poll submitted successfully.");
      closeModal();
      fetchPolls();
    } catch (error: any) {
      console.error("Error submitting poll:", error);
      const msg = error.response?.data?.error || error.message || "Failed to submit poll";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getDueBadge = (endDate: string, isCompleted: boolean) => {
    if (isCompleted) return { text: "Completed", color: "#4CAF50", bg: "#E8F5E9" };
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: "Expired", color: "#F44336", bg: "#FFEBEE" };
    if (days === 0) return { text: "Due today", color: "#FF9800", bg: "#FFF3E0" };
    if (days <= 2) return { text: `${days}d left`, color: "#FF9800", bg: "#FFF3E0" };
    return { text: `${days}d left`, color: "#2196F3", bg: "#E3F2FD" };
  };

  const renderPollCard = ({ item }: { item: Poll }) => {
    const badge = getDueBadge(item.end_date, item.is_completed);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openPoll(item)} activeOpacity={0.85}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
            </View>
          </View>
          {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.metaRow}>
            <Icon name="label" size={14} color="#9CA3AF" />
            <Text style={styles.metaText}>{item.category}</Text>
          </View>
          <View style={styles.metaRow}>
            <Icon name="poll" size={14} color="#9CA3AF" />
            <Text style={styles.metaText}>{item.poll_type}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderQuestion = (q: PollQuestion) => {
    const value = answers[q.id];

    if (q.question_type === "multiple-choice") {
      return (
        <View style={styles.optionsGroup}>
          {(q.options || []).map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.optionRow, value === opt && styles.optionRowSelected]}
              onPress={() => setAnswer(q.id, opt)}
            >
              <Icon
                name={value === opt ? "radio-button-checked" : "radio-button-unchecked"}
                size={20}
                color={value === opt ? "#2196F3" : "#9CA3AF"}
              />
              <Text style={[styles.optionText, value === opt && styles.optionTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (q.question_type === "checkbox") {
      return (
        <View style={styles.optionsGroup}>
          {(q.options || []).map((opt, idx) => {
            const selected = (value || []).includes(opt);
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
                onPress={() => {
                  const current = value || [];
                  setAnswer(q.id, selected ? current.filter((v: string) => v !== opt) : [...current, opt]);
                }}
              >
                <Icon
                  name={selected ? "check-box" : "check-box-outline-blank"}
                  size={20}
                  color={selected ? "#2196F3" : "#9CA3AF"}
                />
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    if (q.question_type === "rating") {
      return (
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((r) => (
            <TouchableOpacity key={r} onPress={() => setAnswer(q.id, r)} style={styles.ratingButton}>
              <Icon name={value >= r ? "star" : "star-border"} size={32} color={value >= r ? "#FFC107" : "#E5E7EB"} />
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (q.question_type === "yes-no") {
      return (
        <View style={styles.optionsGroup}>
          {["Yes", "No"].map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.optionRow, value === opt && styles.optionRowSelected]}
              onPress={() => setAnswer(q.id, opt)}
            >
              <Icon
                name={value === opt ? "radio-button-checked" : "radio-button-unchecked"}
                size={20}
                color={value === opt ? "#2196F3" : "#9CA3AF"}
              />
              <Text style={[styles.optionText, value === opt && styles.optionTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (q.question_type === "emoji") {
      return (
        <View style={styles.emojiRow}>
          {["😀", "😐", "😞"].map((emoji) => (
            <TouchableOpacity key={emoji} onPress={() => setAnswer(q.id, emoji)} style={styles.emojiButton}>
              <Text style={[styles.emojiText, value === emoji && styles.emojiSelected]}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    return (
      <TextInput
        style={styles.textInput}
        placeholder="Type your answer"
        value={value || ""}
        onChangeText={(text) => setAnswer(q.id, text)}
        multiline
        numberOfLines={3}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Search + Filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search polls..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
          <Icon name="filter-list" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "new" && styles.tabActive]}
          onPress={() => setActiveTab("new")}
        >
          <Text style={[styles.tabText, activeTab === "new" && styles.tabTextActive]}>NEW</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "sent" && styles.tabActive]}
          onPress={() => setActiveTab("sent")}
        >
          <Text style={[styles.tabText, activeTab === "sent" && styles.tabTextActive]}>SENT</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : (
        <FlatList
          data={filteredPolls}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPollCard}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="poll" size={64} color="#E5E7EB" />
              <Text style={styles.emptyText}>
                {activeTab === "sent" ? "No submitted polls" : "No polls assigned yet"}
              </Text>
              <Text style={styles.emptySubtext}>
                {activeTab === "sent"
                  ? "Polls you submit will appear here"
                  : "Polls shared with you will appear here"}
              </Text>
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Icon name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {categoryOptions.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.filterOption}
                  onPress={() => toggleCategory(cat)}
                >
                  <Icon
                    name={filters.category.includes(cat) ? "check-box" : "check-box-outline-blank"}
                    size={22}
                    color={filters.category.includes(cat) ? "#2196F3" : "#9CA3AF"}
                  />
                  <Text style={styles.filterOptionText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setFilters(getDefaultFilters())}
            >
              <Text style={styles.clearButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Poll Detail / Submit Modal */}
      <Modal visible={!!selectedPoll} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>{selectedPoll?.title}</Text>
              <TouchableOpacity onPress={closeModal} disabled={submitting}>
                <Icon name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.detailScroll}>
              {selectedPoll?.description ? (
                <Text style={styles.detailDesc}>{selectedPoll.description}</Text>
              ) : null}
              {(selectedPoll?.questions || []).map((q, idx) => (
                <View key={q.id} style={styles.questionCard}>
                  <Text style={styles.questionText}>
                    {idx + 1}. {q.question_text}
                    {q.required ? <Text style={styles.required}> *</Text> : null}
                  </Text>
                  {renderQuestion(q)}
                </View>
              ))}
              <View style={{ height: 100 }} />
            </ScrollView>
            <View style={styles.detailFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal} disabled={submitting}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={submitPoll}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6", padding: 12 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchInput: { flex: 1, paddingVertical: 10, marginLeft: 6, fontSize: 14 },
  filterButton: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#2196F3" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#6B7280", textTransform: "uppercase" },
  tabTextActive: { color: "#2196F3" },
  list: { paddingBottom: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { marginBottom: 10 },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#111827", lineHeight: 20 },
  cardDesc: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  cardFooter: { flexDirection: "row", gap: 12, marginTop: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, color: "#6B7280" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 16 },
  emptySubtext: { fontSize: 13, color: "#9CA3AF", marginTop: 4, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "70%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#111827", flex: 1, marginRight: 8 },
  filterOption: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  filterOptionText: { fontSize: 14, color: "#374151" },
  clearButton: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center" },
  clearButtonText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  detailContent: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "92%" },
  detailScroll: { maxHeight: "80%" },
  detailDesc: { fontSize: 14, color: "#6B7280", marginBottom: 14 },
  questionCard: { marginBottom: 16, padding: 12, backgroundColor: "#F9FAFB", borderRadius: 8 },
  questionText: { fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 10 },
  required: { color: "#EF4444" },
  optionsGroup: { gap: 8 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  optionRowSelected: { borderColor: "#2196F3", backgroundColor: "#E3F2FD" },
  optionText: { fontSize: 14, color: "#374151" },
  optionTextSelected: { color: "#2196F3", fontWeight: "600" },
  ratingRow: { flexDirection: "row", gap: 12 },
  ratingButton: { padding: 4 },
  emojiRow: { flexDirection: "row", gap: 16 },
  emojiButton: { padding: 8 },
  emojiText: { fontSize: 32, opacity: 0.5 },
  emojiSelected: { opacity: 1, transform: [{ scale: 1.2 }] },
  textInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    textAlignVertical: "top",
  },
  detailFooter: { flexDirection: "row", gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  cancelButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center" },
  cancelButtonText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  submitButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: "#2196F3", alignItems: "center" },
  submitButtonDisabled: { backgroundColor: "#93C5FD" },
  submitButtonText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});

export default PollsScreen;
