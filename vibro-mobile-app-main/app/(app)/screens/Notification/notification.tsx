import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Platform,
  BackHandler,
} from 'react-native';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootState } from '../../../../Redux/reducer/rootReducer';
import api from '../../../../services';
import { fetchFormReceived } from '../../../../Redux/actions/formReceivedActions';
import { RECEIVED, USERS_LIST, GETFORMSUBMISSIONDETAILS } from '../../../../services/constants';
import Toast from 'react-native-toast-message';
import { router, useLocalSearchParams } from 'expo-router';
import { Header } from '../../../../components/Header';
import { MaterialIcons } from '@expo/vector-icons';
import KeyboardAwareContainer from '../../../../components/KeyboardAwareContainer';

interface User {
  phone: string;
  department_details: any;
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  email?: string;
}

interface Group {
  id: number;
  name: string;
}

interface NotificationItem {
  form_id: number;
  form_submission_id?: number;
  form_title: string;
  shared_by?: string;
  shared_on?: string;
  completed_by?: string;
  completed_on?: string;
  shared_to_user_id?: number;
  shared_to_group_id?: number;
  share_type?: string;
  stages_count?: number;
  total_stages?: number;
  status?: string;
  submitted_on?: string;
  created_at?: string;
  updated_at?: string;
  submitted_by?: string;
}

const Notification = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.user);
  const receivedAssignment = useSelector((state: RootState) => state.formReceived.data);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flatData, setFlatData] = useState<NotificationItem[]>([]);
  const params = useLocalSearchParams<{ showSharedOnly?: string; returnPath?: string }>();
  const [showSharedOnly, setShowSharedOnly] = useState(params.showSharedOnly === 'true'); // ✅ CHANGED TO FALSE
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [triggeredByShare, setTriggeredByShare] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'groups' | 'leaders'>('user');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [modalUsers, setModalUsers] = useState<User[]>([]);
  const [modalGroups, setModalGroups] = useState<Group[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const returnPath = params.returnPath as string | undefined;
  const hasLoadedOnceRef = useRef(false);

  const handleBackNavigation = useCallback(() => {
    if (returnPath) {
      router.replace(returnPath as any);
      return true;
    }
    router.back();
    return true;
  }, [returnPath]);

  const getReceivedStageAssignUuid = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      let response;
      try {
        response = await api.get('/form/response/');
      } catch (mainError: any) {
        try {
          response = await api.get(`${RECEIVED}${user.id}/`);
        } catch (fallbackError: any) {
          throw fallbackError;
        }
      }

      const responseData: NotificationItem[] = Array.isArray(response.data) ? response.data : [];

      const enhancedData = await Promise.all(
        responseData.map(async (item: NotificationItem) => {

          if (!item.form_submission_id) {
            const completionDate = item.completed_on || item.submitted_on || item.shared_on || item.created_at || item.updated_at;
            return {
              ...item,
              completed_on: completionDate,
              completed_by: item.completed_by || item.submitted_by || user.username
            };
          }

          // ✅ TRY CORRECT ENDPOINT FORMATS
          const endpoints = [
            `/form/submission/${item.form_submission_id}/`, // Original
            `${GETFORMSUBMISSIONDETAILS}${item.form_id}/${item.form_submission_id}`, // Form-specific
            `/form/${item.form_id}/submission/${item.form_submission_id}/` // Alternative
          ];

          let submissionDetail = null;
          let usedEndpoint = '';

          for (const endpoint of endpoints) {
            try {
              const detailResponse = await api.get(endpoint);
              
              submissionDetail = detailResponse.data;
              usedEndpoint = endpoint;
              break;
            } catch (error: any) {
            }
          }

          if (submissionDetail) {
            const completionDate = submissionDetail.completed_on || 
                                 submissionDetail.submitted_on || 
                                 submissionDetail.created_at || 
                                 submissionDetail.updated_at;

            return {
              ...item,
              completed_on: completionDate,
              completed_by: submissionDetail.completed_by || item.completed_by || item.submitted_by || user.username
            };
          }

          // ✅ FALLBACK - Use submission date from main response
          const completionDate = item.completed_on || item.submitted_on || item.shared_on || item.created_at || item.updated_at;
          return {
            ...item,
            completed_on: completionDate,
            completed_by: item.completed_by || item.submitted_by || user.username
          };
        })
      );

      // ✅ RELAXED FILTERING - SHOW ALL FORMS FIRST
      let filteredData: NotificationItem[] = enhancedData;
      
      if (showSharedOnly) {
        filteredData = enhancedData.filter((item: NotificationItem) => {
          // ✅ BROAD MATCH - ANY sharing indicator
          return Boolean(
            item.shared_on ||
              item.shared_by ||
              item.shared_to_user_id ||
              item.shared_to_group_id ||
              item.share_type,
          );
        });
      }

      // Latest shared/submitted/completed first
      const getSortTimestamp = (item: NotificationItem) => {
        const raw =
          item.shared_on ||
          item.completed_on ||
          item.submitted_on ||
          item.updated_at ||
          item.created_at;
        const t = raw ? new Date(raw).getTime() : 0;
        return Number.isFinite(t) ? t : 0;
      };
      filteredData = [...filteredData].sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));

      dispatch(fetchFormReceived(responseData));
      setFlatData(filteredData);

      filteredData.forEach((item, index) => {
        const dateStr = item.completed_on ? new Date(item.completed_on).toLocaleString('en-IN') : 'No Date';
      });

    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to fetch notifications.';
      setError(errorMessage);
      Toast.show({ type: 'error', text1: 'Error', text2: errorMessage, position: 'top' });
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedOnceRef.current = true;
    }
  };

  const refreshData = useCallback(() => {
    getReceivedStageAssignUuid(true);
  }, []);

  const getUsers = useCallback(async () => {
    try {
      const response = await api.get(USERS_LIST);
      const usersData: User[] = Array.isArray(response.data) ? response.data : [];
      setUsers(usersData);
      setModalUsers(usersData);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load users.',
        position: 'top',
      });
    }
  }, []);

  const getGroups = useCallback(async () => {
    try {
      const response = await api.get('/groups/');
      const groupsData: Group[] = Array.isArray(response.data) ? response.data : [];
      setGroups(groupsData);
      setModalGroups(groupsData);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load groups.',
        position: 'top',
      });
    }
  }, []);

  useEffect(() => {
    if (user.id) {
      getReceivedStageAssignUuid();
      getUsers();
      getGroups();
    } else {
      setLoading(false);
      setError('User not logged in.');
    }
  }, [user.id, getUsers, getGroups]);

  useEffect(() => {
    if (params.showSharedOnly === undefined) return;
    setShowSharedOnly(params.showSharedOnly === 'true');
  }, [params.showSharedOnly]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackNavigation);
      return () => subscription.remove();
    }, [handleBackNavigation])
  );

  // Refresh notifications when returning to this screen (e.g., after sharing to self)
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      if (!hasLoadedOnceRef.current) return;
      getReceivedStageAssignUuid(true);
    }, [user?.id])
  );

  const handleItemPress = (item: NotificationItem, isEdit?: boolean) => {

    const pathname = '/(app)/(tabs)/forms/multi-stage-form';
    router.push({
      pathname,
      params: {
        formId: item.form_id,
        submissionId: item.form_submission_id,
        formTitle: item.form_title || 'Untitled Form',
        viewMode: 'true',
        fromNotification: 'true',
        sourceScreen: 'notification',
        returnToSharedOnly: showSharedOnly ? 'true' : 'false',
        notificationReturnPath: returnPath,
      },
    } as any);
  };

  const toggleSelection = useCallback((id: number) => {
    setSelectedUserIds((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id];
      return newSelection;
    });
  }, []);

  const assignUser = useCallback(async () => {
    if (!selectedItem || !triggeredByShare || !selectedItem.form_submission_id || !selectedUserIds.length) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select users to share with.',
        position: 'top',
      });
      return;
    }

    let payload: any = {};
    if (activeTab === 'user') payload.users = selectedUserIds;
    else if (activeTab === 'groups') payload.groups = selectedUserIds;

    try {
      setModalLoading(true);
      await api.post(`/form/submission/share/${selectedItem.form_id}/${selectedItem.form_submission_id}/`, payload);
      
      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: 'Form shared successfully!',
        position: 'top',
      });

      setShowAssignModal(false);
      setSelectedUserIds([]);
      setTriggeredByShare(false);
      setSelectedItem(null);
      setSearchQuery('');

      setTimeout(() => getReceivedStageAssignUuid(true), 1500);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Share Failed',
        text2: error.response?.data?.detail || 'Failed to share form.',
        position: 'top',
      });
    } finally {
      setModalLoading(false);
    }
  }, [activeTab, selectedUserIds, selectedItem, triggeredByShare, getReceivedStageAssignUuid]);

  const handleEdit = (item: NotificationItem) => handleItemPress(item, true);

  const handleShare = async (item: NotificationItem) => {
    setSelectedItem(item);
    setTriggeredByShare(true);
    setActiveTab('user');
    setSelectedUserIds([]);
    setSearchQuery('');

    setModalLoading(true);
    try {
      await Promise.all([getUsers(), getGroups()]);
      setShowAssignModal(true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load sharing options.',
        position: 'top',
      });
    } finally {
      setModalLoading(false);
    }
  };

  const showMenu = (item: NotificationItem) => {
    Alert.alert(
      'Options',
      `Choose an action for "${item.form_title}"`,
      [
        { text: 'View', onPress: () => handleItemPress(item, false) },
        { text: 'Edit', onPress: () => handleEdit(item) },
        { text: 'Share', onPress: () => handleShare(item) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const closeModal = () => {
    setShowAssignModal(false);
    setTriggeredByShare(false);
    setSelectedItem(null);
    setSelectedUserIds([]);
    setSearchQuery('');
  };

  const filteredOptions = useMemo<(User | Group)[]>(() => {
    const list = activeTab === 'groups' ? modalGroups : modalUsers;
    if (!list?.length) return [];
    return list.filter((item: User | Group) => {
      const searchValue = activeTab === 'groups' 
        ? (item as Group).name 
        : (item as User).username;
      return searchValue?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [modalUsers, modalGroups, activeTab, searchQuery]);

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => handleItemPress(item)}
      onLongPress={() => showMenu(item)}
    >
      <View style={styles.itemContent}>
        <Text style={styles.title}>{item.form_title || 'Untitled Form'}</Text>
        
        <View style={styles.completedInfo}>
          <View style={styles.completedInfoRow}>
            <MaterialIcons name="person" size={14} color="#007AFF" style={styles.completedInfoIcon} />
            <Text style={styles.completedInfoText}>
              Completed by: {item.completed_by || 'Unknown User'}
            </Text>
          </View>
          <View style={styles.completedInfoRow}>
            <MaterialIcons name="event" size={14} color="#007AFF" style={styles.completedInfoIcon} />
            <Text style={styles.completedInfoText}>
              Completed on: {item.completed_on 
                ? new Date(item.completed_on).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                : 'Not completed'}
            </Text>
          </View>
        </View>

      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color="#2196f3" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['bottom']}>
        <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshData}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header title="Notifications" showBack onBackPress={() => handleBackNavigation()} />

      <View style={styles.controlPanel}>
        <TouchableOpacity
          style={[styles.filterButton, !showSharedOnly && styles.activeFilterButton]}
          onPress={() => setShowSharedOnly(false)}
        >
          <Text style={styles.filterButtonText}>All Forms ({flatData.length})</Text>
        </TouchableOpacity>
        {/* <TouchableOpacity
          style={[styles.filterButton, showSharedOnly && styles.activeFilterButton]}
          onPress={() => setShowSharedOnly(true)}
        >
          <Text style={styles.filterButtonText}>Shared Only</Text>
        </TouchableOpacity> */}
      </View>
      
      <FlatList
        data={flatData}
        keyExtractor={(item, index) => (item.form_submission_id ?? `item-${index}`).toString()}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={refreshData}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="notifications-off" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {showSharedOnly ? 'there is no shared forms for you' : 'No forms available'}
            </Text>
            <TouchableOpacity style={styles.emptyActionButton} onPress={refreshData}>
              <Text style={styles.emptyActionText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={flatData.length === 0 ? styles.emptyListContent : styles.listContent}
      />

      <Modal visible={showAssignModal} animationType="slide" transparent={true} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAwareContainer
            style={styles.modalContent}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20}
          >
            <Text style={styles.modalTitle}>Share Form</Text>
            <Text style={styles.modalSubtitle}>Share "{selectedItem?.form_title}" with others</Text>

            {modalLoading ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.modalLoadingText}>Loading...</Text>
              </View>
            ) : (
              <>
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    onPress={() => setActiveTab('user')}
                    style={[styles.tabButton, activeTab === 'user' && styles.activeTab]}
                  >
                    <Text style={styles.tabText}>Users ({modalUsers.length})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setActiveTab('groups')}
                    style={[styles.tabButton, activeTab === 'groups' && styles.activeTab]}
                  >
                    <Text style={styles.tabText}>Groups ({modalGroups.length})</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />

                <FlatList<User | Group>
                  data={filteredOptions}
                  keyExtractor={(item: User | Group) => item.id.toString()}
                  style={styles.modalList}
                  contentContainerStyle={styles.modalListContent}
                  renderItem={({ item }: { item: User | Group }) => (
                    <TouchableOpacity
                      style={[
                        styles.optionItem,
                        selectedUserIds.includes(item.id) && styles.selectedOptionItem,
                      ]}
                      onPress={() => toggleSelection(item.id)}
                    >
                      <Text style={styles.optionText}>
                        {activeTab === 'groups'
                          ? (item as Group).name
                          : `${(item as User).first_name} ${(item as User).last_name} (${
                              (item as User).username
                            })`}
                      </Text>
                      {selectedUserIds.includes(item.id) && (
                        <MaterialIcons name="check" size={20} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />

                <View style={styles.footerContainer}>
                  <TouchableOpacity
                    onPress={assignUser}
                    style={[
                      styles.assignButton,
                      selectedUserIds.length === 0 && styles.disabledButton,
                    ]}
                    disabled={selectedUserIds.length === 0 || modalLoading}
                  >
                    <Text style={styles.footerButtonText}>
                      {modalLoading ? 'Sharing...' : `Share (${selectedUserIds.length})`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={closeModal} style={styles.closeButton} disabled={modalLoading}>
                    <Text style={styles.footerButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </KeyboardAwareContainer>
        </View>
      </Modal>

      <Toast />
    </SafeAreaView>
  );
};

// ✅ STYLES (UNCHANGED)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  controlPanel: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterButton: {
    flex: 1,
    padding: 10,
    marginHorizontal: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignItems: 'center',
  },
  activeFilterButton: { backgroundColor: '#e2e2e2' },
  filterButtonText: { fontSize: 14, color: '#333' },
  resultCount: { padding: 10, fontSize: 16, color: '#3f3f3f', backgroundColor: '#fff' },
  listContent: { padding: 10 },
  emptyListContent: { flexGrow: 1, justifyContent: 'center' },
  itemContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemContent: { flex: 1 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  sharedInfo: {
    backgroundColor: '#F0F9F0',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#34C759',
    marginTop: 8,
  },
  sharedInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  sharedInfoIcon: { marginRight: 6 },
  sharedInfoText: { fontSize: 12, color: '#34C759', fontWeight: '500' },
  completedInfo: {
    backgroundColor: '#F0F8FF',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    marginTop: 8,
  },
  completedInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  completedInfoIcon: { marginRight: 6 },
  completedInfoText: { fontSize: 13, color: '#007AFF', fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { textAlign: 'center', fontSize: 18, color: '#666', marginTop: 16, marginBottom: 8 },
  emptyActionButton: { marginTop: 10, padding: 12, backgroundColor: '#007AFF', borderRadius: 6, minWidth: 150 },
  emptyActionText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#FF3B30', textAlign: 'center', marginBottom: 20, marginTop: 10 },
  retryButton: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#fff', borderRadius: 10, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 15, textAlign: 'center' },
  modalLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalLoadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  tabContainer: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 10 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  activeTab: { borderColor: '#007AFF' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#333' },
  searchInput: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 14 },
  modalList: { flex: 1 },
  modalListContent: { flexGrow: 1 },
  optionItem: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectedOptionItem: { backgroundColor: '#F0F7FF' },
  optionText: { fontSize: 14, color: '#333', flex: 1 },
  separator: { height: 1, backgroundColor: '#eee' },
  emptyModalContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  modalEmptyText: { fontSize: 14, color: '#999' },
  footerContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee', marginTop: 10 },
  assignButton: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flex: 1, marginHorizontal: 5 },
  disabledButton: { backgroundColor: '#ccc' },
  closeButton: { backgroundColor: '#FF3B30', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flex: 1, marginHorizontal: 5 },
  footerButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});

export default Notification;
