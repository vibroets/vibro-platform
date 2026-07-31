import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import api from '@/services';
import Toast from 'react-native-toast-message';

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email?: string;
}

interface Group {
  id: number;
  name: string;
}

interface FormSettings {
  share_response: boolean;
  allow_editing: boolean;
  can_edit_previous_state: boolean;
  auto_share_response: boolean;
  auto_share_config?: {
    users: number[];
    groups: number[];
    location_leaders: number[];
  };
}

const FormSettingsScreen = () => {
  const { formId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FormSettings>({
    share_response: false,
    allow_editing: false,
    can_edit_previous_state: false,
    auto_share_response: false,
    auto_share_config: {
      users: [],
      groups: [],
      location_leaders: [],
    },
  });

  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showLeaderModal, setShowLeaderModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [selectedLeaders, setSelectedLeaders] = useState<number[]>([]);

  const fetchFormSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/form/${formId}/`);
      const formData = response.data;

      setSettings({
        share_response: formData.share_response || false,
        allow_editing: formData.allow_editing || false,
        can_edit_previous_state: formData.can_edit_previous_state || false,
        auto_share_response: formData.auto_share_response || false,
        auto_share_config: formData.auto_share_config || {
          users: [],
          groups: [],
          location_leaders: [],
        },
      });

      // Set selected items from config
      if (formData.auto_share_config) {
        setSelectedUsers(formData.auto_share_config.users || []);
        setSelectedGroups(formData.auto_share_config.groups || []);
        setSelectedLeaders(formData.auto_share_config.location_leaders || []);
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load form settings',
        position: 'top',
      });
    } finally {
      setLoading(false);
    }
  }, [formId]);

  const fetchUsersAndGroups = useCallback(async () => {
    try {
      const [usersRes, groupsRes] = await Promise.all([
        api.get('/users/'),
        api.get('/groups/'),
      ]);
      setUsers(usersRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (error) {
    }
  }, []);

  useEffect(() => {
    fetchFormSettings();
    fetchUsersAndGroups();
  }, [fetchFormSettings, fetchUsersAndGroups]);

  const saveSettings = async () => {
    try {
      setSaving(true);

      const payload: any = {
        share_response: settings.share_response,
        allow_editing: settings.allow_editing,
        can_edit_previous_state: settings.can_edit_previous_state,
        auto_share_response: settings.auto_share_response,
      };

      // Only include auto_share_config if auto_share_response is enabled
      if (settings.auto_share_response) {
        payload.auto_share_config = {
          users: selectedUsers,
          groups: selectedGroups,
          location_leaders: selectedLeaders,
        };
      }

      await api.patch(`/form/toggle/${formId}/`, payload);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Form settings saved successfully',
        position: 'top',
      });

      router.back();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save form settings',
        position: 'top',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (setting: keyof FormSettings) => {
    setSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const filteredUsers = users.filter(user =>
    `${user.first_name} ${user.last_name} ${user.username}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleGroupSelection = (groupId: number) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleLeaderSelection = (leaderId: number) => {
    setSelectedLeaders(prev =>
      prev.includes(leaderId)
        ? prev.filter(id => id !== leaderId)
        : [...prev, leaderId]
    );
  };

  const SelectionModal = ({
    visible,
    onClose,
    title,
    items,
    selectedItems,
    onToggle,
    renderItem
  }: any) => {
    if (!visible) return null;

    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView style={styles.selectionList}>
            {items.map((item: any) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.selectionItem,
                  selectedItems.includes(item.id) && styles.selectedItem
                ]}
                onPress={() => onToggle(item.id)}
              >
                <Text style={styles.selectionItemText}>
                  {renderItem(item)}
                </Text>
                {selectedItems.includes(item.id) && (
                  <MaterialIcons name="check" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.doneButton}
            onPress={onClose}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Form Settings</Text>

        {/* Basic Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Form Permissions</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Allow Sharing</Text>
              <Text style={styles.settingDescription}>
                Users can share completed forms with others
              </Text>
            </View>
            <Switch
              value={settings.share_response}
              onValueChange={() => toggleSetting('share_response')}
              trackColor={{ false: '#767577', true: '#007AFF' }}
              thumbColor={settings.share_response ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Allow Editing</Text>
              <Text style={styles.settingDescription}>
                Users can edit forms after submission
              </Text>
            </View>
            <Switch
              value={settings.allow_editing}
              onValueChange={() => toggleSetting('allow_editing')}
              trackColor={{ false: '#767577', true: '#007AFF' }}
              thumbColor={settings.allow_editing ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Edit Previous State</Text>
              <Text style={styles.settingDescription}>
                Users can edit previous stages of the form
              </Text>
            </View>
            <Switch
              value={settings.can_edit_previous_state}
              onValueChange={() => toggleSetting('can_edit_previous_state')}
              trackColor={{ false: '#767577', true: '#007AFF' }}
              thumbColor={settings.can_edit_previous_state ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Auto-Share Section */}
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Auto-Share Response</Text>
              <Text style={styles.settingDescription}>
                Automatically share completed forms with selected users/groups
              </Text>
            </View>
            <Switch
              value={settings.auto_share_response}
              onValueChange={() => toggleSetting('auto_share_response')}
              trackColor={{ false: '#767577', true: '#007AFF' }}
              thumbColor={settings.auto_share_response ? '#fff' : '#f4f3f4'}
            />
          </View>

          {settings.auto_share_response && (
            <View style={styles.autoShareConfig}>
              <TouchableOpacity
                style={styles.configButton}
                onPress={() => setShowUserModal(true)}
              >
                <Text style={styles.configButtonText}>
                  Select Users ({selectedUsers.length})
                </Text>
                <MaterialIcons name="chevron-right" size={20} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.configButton}
                onPress={() => setShowGroupModal(true)}
              >
                <Text style={styles.configButtonText}>
                  Select Groups ({selectedGroups.length})
                </Text>
                <MaterialIcons name="chevron-right" size={20} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.configButton}
                onPress={() => setShowLeaderModal(true)}
              >
                <Text style={styles.configButtonText}>
                  Select Location Leaders ({selectedLeaders.length})
                </Text>
                <MaterialIcons name="chevron-right" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={saveSettings}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selection Modals */}
      <SelectionModal
        visible={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setSearchQuery('');
        }}
        title="Select Users"
        items={filteredUsers}
        selectedItems={selectedUsers}
        onToggle={toggleUserSelection}
        renderItem={(user: User) => `${user.first_name} ${user.last_name}`}
      />

      <SelectionModal
        visible={showGroupModal}
        onClose={() => {
          setShowGroupModal(false);
          setSearchQuery('');
        }}
        title="Select Groups"
        items={filteredGroups}
        selectedItems={selectedGroups}
        onToggle={toggleGroupSelection}
        renderItem={(group: Group) => group.name}
      />

      <SelectionModal
        visible={showLeaderModal}
        onClose={() => {
          setShowLeaderModal(false);
          setSearchQuery('');
        }}
        title="Select Location Leaders"
        items={filteredUsers}
        selectedItems={selectedLeaders}
        onToggle={toggleLeaderSelection}
        renderItem={(user: User) => `${user.first_name} ${user.last_name}`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  autoShareConfig: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 10,
  },
  configButtonText: {
    fontSize: 14,
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    marginRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 15,
    marginLeft: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  selectionList: {
    maxHeight: 300,
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedItem: {
    backgroundColor: '#f0f7ff',
  },
  selectionItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  doneButton: {
    backgroundColor: '#007AFF',
    margin: 20,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FormSettingsScreen;
