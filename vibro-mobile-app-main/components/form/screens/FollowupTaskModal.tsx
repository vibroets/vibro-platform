import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../services';
import { USERS_LIST } from '../../../services/constants';
import { textColors, typography } from '../../../styles/typography';

const GROUPS_LIST = "/groups/";

interface FollowupTaskModalProps {
  visible: boolean;
  onClose: () => void;
  taskId: string;
  onTaskCreated: (taskData: any) => void;
  currentQuestion?: {
    id: number;
  };
}

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  department_details?: {
    description: string;
  };
}

interface Group {
  id: number;
  name: string;
  description?: string;
}

const FollowupTaskModal: React.FC<FollowupTaskModalProps> = ({
  visible,
  onClose,
  taskId,
  onTaskCreated,
  currentQuestion
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Groups state
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  // Filter users and groups based on search
  const filteredUsers = users.filter(user =>
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
    (group.description && group.description.toLowerCase().includes(groupSearch.toLowerCase()))
  );

  // Fetch users and groups when modal opens
  useEffect(() => {
    if (visible) {
      if (activeTab === 'users' && users.length === 0) {
        fetchUsers();
      } else if (activeTab === 'groups' && groups.length === 0) {
        fetchGroups();
      }
    }
  }, [visible, activeTab]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const response = await api.get(USERS_LIST);
      setUsers(response.data || []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load users',
        position: 'top'
      });
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const response = await api.get(GROUPS_LIST);
      setGroups(response.data || []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load groups',
        position: 'top'
      });
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const toggleUserSelection = useCallback((userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }, []);

  const toggleGroupSelection = useCallback((groupId: number) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  }, []);

  const handleCreateTask = useCallback(async () => {
    if (!title.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Required',
        text2: 'Please provide a title for the followup task',
        position: 'top'
      });
      return;
    }

    if (selectedUsers.length === 0 && selectedGroups.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Required',
        text2: 'Please select at least one user or group to assign the task to',
        position: 'top'
      });
      return;
    }

    setSubmitting(true);
    try {
      // Call the followup task creation endpoint
      const response = await api.post(`/tasks/${taskId}/create_followup/`, {
        title: title.trim(),
        description: description.trim(),
        assigned_users: selectedUsers,
        assigned_groups: selectedGroups,
        follow_task_sub_question_id: currentQuestion?.id
      });

      const taskData = response.data;
      
      Toast.show({
        type: 'success',
        text1: 'Followup Task Created',
        text2: `Followup task "${title}" has been created successfully`,
        position: 'top'
      });

      // Call the callback to notify parent component
      onTaskCreated(taskData);
      
      // Close the modal
      onClose();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.message || 'Failed to create followup task',
        position: 'top'
      });
    } finally {
      setSubmitting(false);
    }
  }, [taskId, title, description, selectedUsers, selectedGroups, onTaskCreated, onClose]);

  const resetModal = useCallback(() => {
    setTitle('');
    setDescription('');
    setSelectedUsers([]);
    setSelectedGroups([]);
    setSubmitting(false);
  }, []);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!visible) {
      resetModal();
    }
  }, [visible, resetModal]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Followup Task</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Title Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Task Title *</Text>
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter task title"
                maxLength={255}
              />
            </View>

            {/* Description Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter task description"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Assignment Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Assign to Users/Groups</Text>

              {/* Tabs */}
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'users' && styles.activeTab]}
                  onPress={() => setActiveTab('users')}
                >
                  <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
                    Users ({selectedUsers.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
                  onPress={() => setActiveTab('groups')}
                >
                  <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
                    Groups ({selectedGroups.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Users Tab */}
              {activeTab === 'users' && (
                <>
                  {/* Search Bar */}
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search users..."
                      value={userSearch}
                      onChangeText={setUserSearch}
                    />
                  </View>

                  {loadingUsers ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : filteredUsers.length > 0 ? (
                    <View style={styles.scrollContainer}>
                      <ScrollView
                        style={styles.userScrollView}
                        showsVerticalScrollIndicator={true}
                        indicatorStyle="black"
                        persistentScrollbar={true}
                        contentContainerStyle={styles.scrollContent}
                      >
                        {filteredUsers.map((item) => (
                          <TouchableOpacity
                            key={item.id.toString()}
                            style={styles.userItem}
                            onPress={() => toggleUserSelection(item.id)}
                          >
                            <MaterialCommunityIcons
                              name={selectedUsers.includes(item.id) ? "checkbox-marked" : "checkbox-blank-outline"}
                              size={24}
                              color={selectedUsers.includes(item.id) ? "#007AFF" : "#666"}
                            />
                            <View style={styles.userInfo}>
                              <Text style={styles.userName}>
                                {item.first_name} {item.last_name}
                              </Text>
                              <Text style={styles.userDepartment}>
                                {item.department_details?.description || 'N/A'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>
                      {userSearch ? 'No users found matching your search' : 'No users available'}
                    </Text>
                  )}
                </>
              )}

              {/* Groups Tab */}
              {activeTab === 'groups' && (
                <>
                  {/* Search Bar */}
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search groups..."
                      value={groupSearch}
                      onChangeText={setGroupSearch}
                    />
                  </View>

                  {loadingGroups ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : filteredGroups.length > 0 ? (
                    <View style={styles.scrollContainer}>
                      <ScrollView
                        style={styles.userScrollView}
                        showsVerticalScrollIndicator={true}
                        indicatorStyle="black"
                        persistentScrollbar={true}
                        contentContainerStyle={styles.scrollContent}
                      >
                        {filteredGroups.map((item) => (
                          <TouchableOpacity
                            key={item.id.toString()}
                            style={styles.userItem}
                            onPress={() => toggleGroupSelection(item.id)}
                          >
                            <MaterialCommunityIcons
                              name={selectedGroups.includes(item.id) ? "checkbox-marked" : "checkbox-blank-outline"}
                              size={24}
                              color={selectedGroups.includes(item.id) ? "#007AFF" : "#666"}
                            />
                            <View style={styles.userInfo}>
                              <Text style={styles.userName}>
                                {item.name}
                              </Text>
                              {item.description && (
                                <Text style={styles.userDepartment}>
                                  {item.description}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>
                      {groupSearch ? 'No groups found matching your search' : 'No groups available'}
                    </Text>
                  )}
                </>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.createButton, submitting && styles.disabledButton]}
              onPress={handleCreateTask}
              disabled={submitting || !title.trim()}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.createButtonText}>Create Task</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '70%',
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    ...typography.titleMedium,
    color: textColors.primary,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    maxHeight: 300,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...typography.labelLarge,
    color: textColors.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: textColors.primary,
    backgroundColor: '#fff',
    minHeight: 50,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: textColors.primary,
    backgroundColor: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#6b7280',
  },
  cancelButtonText: {
    ...typography.labelLarge,
    color: 'white',
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  createButtonText: {
    ...typography.labelLarge,
    color: 'white',
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#c7c7cc',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    ...typography.labelLarge,
    color: textColors.primary,
    fontWeight: '500',
  },
  userDepartment: {
    ...typography.labelSmall,
    color: textColors.secondary,
    marginTop: 2,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: textColors.secondary,
    textAlign: 'center',
    padding: 20,
  },
  userList: {
    maxHeight: 200,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: textColors.primary,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    ...typography.labelMedium,
    color: '#64748b',
    fontWeight: '500',
  },
  activeTabText: {
    color: 'white',
  },
  userScrollView: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
});


