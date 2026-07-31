// AppLayout.tsx
import React, { Dispatch, SetStateAction, useState, useRef, useEffect } from "react";
import { Drawer } from "expo-router/drawer";
import AuthWrapper from "../../components/AuthWrapper";
import CustomDrawer from "@/components/CustomDrawer";
import {
  TouchableOpacity,
  Platform,
  StatusBar,
  View,
  Text,
  ScrollView,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSegments, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/Redux/reducer/rootReducer";
import { AnnouncementItem, patchAnnouncement } from "@/Redux/reducer/announcements/announcementsSlice";
import api from "@/services";
import { registerBackgroundSync } from "@/services/backgroundSyncTask";
import ChatBot from "@/components/ChatBot";

type FormOptions = {
  enabled: boolean;
  onEdit?: () => void;
  onShare?: () => void;
  onPdf?: () => void;
};

type ToggleContextType = {
  isToggleEnabled: boolean;
  setIsToggleEnabled: Dispatch<SetStateAction<boolean>>;
  formOptions: FormOptions;
  setFormOptions: Dispatch<SetStateAction<FormOptions>>;
  formId: string | undefined;
  setFormId: Dispatch<SetStateAction<string | undefined>>;
  submissionId: string | undefined;
  setSubmissionId: Dispatch<SetStateAction<string | undefined>>;
  showBackButton: boolean;
  setShowBackButton: Dispatch<SetStateAction<boolean>>;
  onBackPress?: () => void;
  setOnBackPress: Dispatch<SetStateAction<(() => void) | undefined>>;
};

export const ToggleContext = React.createContext<ToggleContextType | undefined>(
  undefined
);

export const useToggleContext = () => {
  const context = React.useContext(ToggleContext);
  if (!context) {
    throw new Error("useToggleContext must be used within a ToggleContext.Provider");
  }
  return context;
};

export default function AppLayout() {
  const segments = useSegments();
  const lastSegment = segments[segments.length - 1];
  const hideHeader = ["multi-stage-form", "folder-list"].includes(lastSegment);

  const [isToggleEnabled, setIsToggleEnabled] = React.useState(false);
  const [formOptions, setFormOptions] = React.useState<FormOptions>({ enabled: false });
  const [formId, setFormId] = React.useState<string | undefined>(undefined);
  const [submissionId, setSubmissionId] = React.useState<string | undefined>(undefined);
  const [showBackButton, setShowBackButton] = React.useState(false);
  const [onBackPress, setOnBackPress] = React.useState<(() => void) | undefined>(undefined);

  // Refs to hold latest values — headerLeft closure reads from these
  // to avoid stale captures that make the back button unresponsive.
  const onBackPressRef = useRef<(() => void) | undefined>(undefined);
  const showBackButtonRef = useRef(false);
  useEffect(() => {
    onBackPressRef.current = onBackPress;
  }, [onBackPress]);
  useEffect(() => {
    showBackButtonRef.current = showBackButton;
  }, [showBackButton]);
  const [showFormOptionsMenu, setShowFormOptionsMenu] = useState(false);

  const [showNotifications, setShowNotifications] = useState(false);
  const [activeNotificationTab, setActiveNotificationTab] = useState<"announcements" | "shared" | "training">("announcements");
  const [sharedFormsCount, setSharedFormsCount] = useState<number | null>(null);
  const [sharedFormsLoading, setSharedFormsLoading] = useState(false);
  const [ltNotifications, setLtNotifications] = useState<any[]>([]);
  const [ltUnreadCount, setLtUnreadCount] = useState(0);
  const [ltLoading, setLtLoading] = useState(false);

  // Safe Redux usage - only use hooks after component has mounted
  const [hasMounted, setHasMounted] = React.useState(false);
  const dispatch = useDispatch();
  const announcements = useSelector((state: RootState) => state.announcements.announcements);
  const receivedAssignment = useSelector((state: RootState) => state.formReceived.data);
  const organizationName = useSelector((state: RootState) => state.user?.organizationName) || "";

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  React.useEffect(() => {
    registerBackgroundSync();
  }, []);

  // Only compute notifications if component has mounted and Redux is available
  const unreadNotifications = hasMounted ? announcements.filter(i => !i.viewed) : [];
  const announcementCount = hasMounted ? unreadNotifications.length : 0;
  const notificationCount = announcementCount + ltUnreadCount;
  const isSharedForm = (item: any) => !!(
    item?.shared_by ||
    item?.shared_on ||
    item?.shared_to_user_id ||
    item?.shared_to_group_id ||
    item?.share_type ||
    (typeof item?.status === "string" && item.status.toLowerCase().includes("shared"))
  );
  const sharedFormsCountFallback = Array.isArray(receivedAssignment)
    ? receivedAssignment.filter(isSharedForm).length
    : 0;

  React.useEffect(() => {
    if (!showNotifications || activeNotificationTab !== "shared") return;
    let cancelled = false;
    const loadCount = async () => {
      if (sharedFormsLoading) return;
      setSharedFormsLoading(true);
      try {
        const response = await api.get("/form/response/");
        const data = Array.isArray(response.data) ? response.data : [];
        if (!cancelled) setSharedFormsCount(data.filter(isSharedForm).length);
      } catch {
        if (!cancelled) setSharedFormsCount(sharedFormsCountFallback);
      } finally {
        if (!cancelled) setSharedFormsLoading(false);
      }
    };
    loadCount();
    return () => {
      cancelled = true;
    };
  }, [activeNotificationTab, showNotifications]);

  // Fetch L&T notifications when bell opens or training tab is selected
  React.useEffect(() => {
    if (!showNotifications) return;
    let cancelled = false;
    const fetchLtNotifications = async () => {
      setLtLoading(true);
      try {
        const response = await api.get("/learning/my-notifications/");
        if (!cancelled) {
          setLtNotifications(response.data.notifications || []);
          setLtUnreadCount(response.data.unread_count || 0);
        }
      } catch {
        if (!cancelled) {
          setLtNotifications([]);
          setLtUnreadCount(0);
        }
      } finally {
        if (!cancelled) setLtLoading(false);
      }
    };
    fetchLtNotifications();
    return () => { cancelled = true; };
  }, [showNotifications]);

  // Handle bell press (when opening)
  const handleBellPress = () => {
    // When opening notifications, mark all unread as notified
    if (!showNotifications && unreadNotifications.length > 0) {
      unreadNotifications.forEach(item =>
        dispatch(patchAnnouncement({ id: item.id, type: "notified", value: true }))
      );
    }
    if (!showNotifications) {
      setActiveNotificationTab(announcementCount > 0 ? "announcements" : ltUnreadCount > 0 ? "training" : "announcements");
    }
    setShowNotifications(!showNotifications);
  };

  // Handle notification click
  const handleNotificationClick = (item: AnnouncementItem) => {
    setShowNotifications(false);
    // Mark as viewed
    dispatch(patchAnnouncement({ id: item.id, type: "viewed", value: true }));
    // Navigate to detail screen
    router.push({ pathname: '/announcement-detail', params: { id: item.id } });
  };

  const handleSharedFormPress = () => {
    setActiveNotificationTab("shared");
  };

  const handleAnnouncementsPress = () => {
    setActiveNotificationTab("announcements");
  };

  const handleTrainingPress = () => {
    setActiveNotificationTab("training");
  };

  const handleLtNotificationClick = async (item: any) => {
    setShowNotifications(false);
    try {
      await api.patch(`/learning/my-notifications/${item.id}/mark-read/`);
    } catch {}
    router.push("/(app)/(tabs)/learn" as any);
  };

  const handleMarkAllLtRead = async () => {
    try {
      await api.patch("/learning/my-notifications/mark-all-read/");
      setLtNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setLtUnreadCount(0);
    } catch {}
  };

  const handleOpenSharedForms = () => {
    const returnPath = `/${segments.join("/")}`;
    setShowNotifications(false);
    router.push({
      pathname: "/(app)/screens/Notification/notification",
      params: { showSharedOnly: "true", returnPath },
    });
  };

  // Ensure status bar color + style are set whenever layout is focused
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS !== "web") {
        // Keep status bar background matching header
        StatusBar.setBackgroundColor("#2196f3", true);
        StatusBar.setBarStyle("light-content", true);
        // Ensure translucent false so we don't get overlapping safe area space
        // Note: we still render a non-translucent StatusBar below.
      }
      return () => {};
    }, [])
  );

  return (
    <ToggleContext.Provider
      value={{
        isToggleEnabled,
        setIsToggleEnabled,
        formOptions,
        setFormOptions,
        formId,
        setFormId,
        submissionId,
        setSubmissionId,
        showBackButton,
        setShowBackButton,
        onBackPress,
        setOnBackPress,
      }}
    >
      <AuthWrapper>
        {/* Render a single StatusBar instance and keep translucent={false} */}
        {Platform.OS !== "web" && (
          <StatusBar
            backgroundColor="#2196f3"
            barStyle="light-content"
            translucent={false}
          />
        )}

        <Drawer
          // custom drawer content
          drawerContent={(props) => {
            global.drawerNavigation = props.navigation;
            return <CustomDrawer {...props} />;
          }}
          screenOptions={{
            headerShown: true,
            headerTitle: () => (
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "600" }} numberOfLines={1}>
                Vibro{organizationName ? ` | ${organizationName}` : ""}
              </Text>
            ),

            // drawer appearance
            drawerActiveTintColor: "#ffffff",
            drawerInactiveTintColor: "#64748b",
            drawerStyle: { backgroundColor: "#ffffff" },

            // IMPORTANT: keep headerStatusBarHeight = 0 to avoid double-safe-area on Android
            // and keep header height strictly fixed.
            headerStatusBarHeight: 0 as any, // TS: react-navigation accepts number | undefined

            headerStyle: {
              backgroundColor: "#2196f3",
              height: 56, // fixed header height (consistent)
              elevation: 0,
              shadowOpacity: 0,
              // ensure no extra padding
              paddingTop: 0,
            },

            headerTintColor: "#ffffff",
            headerTitleAlign: "center",
            headerTitleStyle: {
              color: "#ffffff",
              fontSize: 18,
              fontWeight: "600",
            },

            // left/right icons
            headerLeft: ({ tintColor }) =>
              hideHeader || showBackButton ? (
                <TouchableOpacity
                  onPress={() => {
                    if (hideHeader) {
                      // On sub-screens (multi-stage-form, folder-list) — just go back
                      router.back();
                    } else if (onBackPressRef.current) {
                      onBackPressRef.current();
                    } else {
                      setShowBackButton(false);
                      setIsToggleEnabled(false);
                      setFormId(undefined);
                      setSubmissionId(undefined);
                      router.back();
                    }
                  }}
                  style={{ padding: 8, marginLeft: 10 }}
                >
                  <Ionicons name="arrow-back" size={24} color={tintColor || "#ffffff"} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => global.drawerNavigation?.openDrawer()}
                  style={{ padding: 8, marginLeft: 10 }}
                >
                  <Ionicons name="menu" size={24} color={tintColor || "#ffffff"} />
                </TouchableOpacity>
              ),

            headerRight: () => (
              <View style={{ flexDirection: "row", alignItems: "center", marginRight: 10 }}>
                {formOptions.enabled && (
                  <TouchableOpacity
                    onPress={() => setShowFormOptionsMenu(true)}
                    style={{ padding: 8, marginRight: 4 }}
                  >
                    <Ionicons name="ellipsis-vertical" size={24} color="#ffffff" />
                  </TouchableOpacity>
                )}
                <View style={{ position: 'relative' }}>
                  <TouchableOpacity onPress={handleBellPress} style={{ padding: 8 }}>
                    <Ionicons name="notifications-outline" size={24} color="#ffffff" />
                  </TouchableOpacity>
                  {notificationCount > 0 && (
                    <View style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      backgroundColor: '#EF4444',
                      borderRadius: 10,
                      minWidth: 20,
                      height: 20,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: '#2196f3',
                    }}>
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 4 }}>
                        {notificationCount > 9 ? '9+' : notificationCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ),
          }}
        >
          <Drawer.Screen
            name="(tabs)"
            options={{
              drawerLabel: "Main Tabs",
            }}
          />
          <Drawer.Screen
            name="form-entry"
            options={{
              drawerLabel: "Form Entry",
              drawerItemStyle: { display: 'none' }, // Hide from drawer menu
            }}
          />
          <Drawer.Screen
            name="announcement-detail"
            options={{
              drawerLabel: "Announcement Detail",
              drawerItemStyle: { display: 'none' }, // Hide from drawer menu
            }}
          />
          <Drawer.Screen
            name="screens/Notification/notification"
            options={{
              headerShown: false,
              drawerLabel: "Notifications",
              drawerItemStyle: { display: 'none' },
            }}
          />
          <Drawer.Screen
            name="screens/FilteredTodo"
            options={{
              headerShown: false,
              drawerLabel: "Filtered Tasks",
              drawerItemStyle: { display: 'none' },
            }}
          />
          <Drawer.Screen
            name="screens/TaskSummaryScreen"
            options={{
              headerShown: false,
              drawerLabel: "Task Summary",
              drawerItemStyle: { display: 'none' },
            }}
          />
          <Drawer.Screen
            name="screens/Todo/sent-task-summary"
            options={{
              headerShown: false,
              drawerLabel: "Sent Task Summary",
              drawerItemStyle: { display: 'none' },
            }}
          />
        </Drawer>

        {/* Floating Chat Bot */}
        <ChatBot />
      </AuthWrapper>

      {/* Form Options Menu */}
      <Modal
        visible={showFormOptionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFormOptionsMenu(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}
          activeOpacity={1}
          onPress={() => setShowFormOptionsMenu(false)}
        >
          <View style={{ backgroundColor: "white", borderRadius: 12, paddingVertical: 8, minWidth: 220, maxWidth: 300 }}>
            {formOptions.onEdit && (
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20 }}
                onPress={() => { setShowFormOptionsMenu(false); formOptions.onEdit?.(); }}
              >
                <Ionicons name="create-outline" size={22} color="#2196f3" style={{ marginRight: 14 }} />
                <Text style={{ fontSize: 16, color: "#333" }}>Edit</Text>
              </TouchableOpacity>
            )}
            {formOptions.onShare && (
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20 }}
                onPress={() => { setShowFormOptionsMenu(false); formOptions.onShare?.(); }}
              >
                <Ionicons name="share-outline" size={22} color="#4caf50" style={{ marginRight: 14 }} />
                <Text style={{ fontSize: 16, color: "#333" }}>Share</Text>
              </TouchableOpacity>
            )}
            {formOptions.onPdf && (
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20 }}
                onPress={() => { setShowFormOptionsMenu(false); formOptions.onPdf?.(); }}
              >
                <Ionicons name="document-text-outline" size={22} color="#e53935" style={{ marginRight: 14 }} />
                <Text style={{ fontSize: 16, color: "#333" }}>PDF</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20 }}
              onPress={() => setShowFormOptionsMenu(false)}
            >
              <Ionicons name="close" size={22} color="#666" style={{ marginRight: 14 }} />
              <Text style={{ fontSize: 16, color: "#333" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Announcements Dropdown (from floating bell) */}
      {showNotifications && (
        <View style={{
          position: 'absolute',
          top: 110, // Below header
          right: 16,
          width: 300,
          backgroundColor: 'white',
          borderRadius: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 10,
          zIndex: 1000,
          borderWidth: 1,
          borderColor: '#E5E7EB',
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#F3F4F6',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={handleAnnouncementsPress}>
              <Text style={{
                fontWeight: 'bold',
                fontSize: 14,
                color: activeNotificationTab === "announcements" ? '#111827' : '#6B7280',
              }}>
                Announcements
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSharedFormPress}>
              <Text style={{
                fontWeight: 'bold',
                fontSize: 14,
                color: activeNotificationTab === "shared" ? '#111827' : '#6B7280',
              }}>
                Shared
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleTrainingPress}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{
                  fontWeight: 'bold',
                  fontSize: 14,
                  color: activeNotificationTab === "training" ? '#111827' : '#6B7280',
                }}>
                  Training
                </Text>
                {ltUnreadCount > 0 && (
                  <View style={{
                    backgroundColor: '#EF4444',
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginLeft: 4,
                  }}>
                    <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold', paddingHorizontal: 3 }}>
                      {ltUnreadCount > 9 ? '9+' : ltUnreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
            <TouchableOpacity onPress={() => setShowNotifications(false)}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {activeNotificationTab === "announcements" ? (
            <>
              {unreadNotifications.length === 0 ? (
                <View style={{ padding: 30, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark-circle" size={40} color="#10B981" />
                  <Text style={{ marginTop: 10, color: '#6B7280', fontSize: 14 }}>You're all caught up!</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 300 }}>
                  {unreadNotifications.map((note) => (
                    <TouchableOpacity
                      key={note.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F9FAFB',
                      }}
                      onPress={() => handleNotificationClick(note)}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', marginRight: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }} numberOfLines={2}>
                          {note.title}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                          {new Date(note.created_on).toLocaleString('en-GB', {
                            hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
                          })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          ) : activeNotificationTab === "shared" ? (
            <View style={{ padding: 20 }}>
              <Text style={{ fontSize: 14, color: '#374151', fontWeight: '600' }}>
                Total Number of Shared Forms: {sharedFormsCount ?? sharedFormsCountFallback}
              </Text>
              {!sharedFormsLoading && sharedFormsCount !== null && sharedFormsCount === 0 && (
                <Text style={{ marginTop: 6, fontSize: 12, color: '#6B7280' }}>
                  There is no Shared Forms.
                </Text>
              )}
              {sharedFormsLoading && (
                <Text style={{ marginTop: 6, fontSize: 12, color: '#9CA3AF' }}>
                  Updating count...
                </Text>
              )}
              <TouchableOpacity
                onPress={handleOpenSharedForms}
                disabled={sharedFormsLoading}
                style={{
                  marginTop: 12,
                  backgroundColor: '#2196f3',
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: 'center',
                  opacity: sharedFormsLoading ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '600' }}>Open</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Training Notifications Tab */
            <View style={{ maxHeight: 350 }}>
              {ltLoading ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Text style={{ color: '#9CA3AF', fontSize: 14 }}>Loading...</Text>
                </View>
              ) : ltNotifications.length === 0 ? (
                <View style={{ padding: 30, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark-circle" size={40} color="#10B981" />
                  <Text style={{ marginTop: 10, color: '#6B7280', fontSize: 14 }}>No training notifications</Text>
                </View>
              ) : (
                <>
                  {ltUnreadCount > 0 && (
                    <TouchableOpacity
                      onPress={handleMarkAllLtRead}
                      style={{ paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
                    >
                      <Text style={{ fontSize: 12, color: '#2196f3', fontWeight: '600', textAlign: 'right' }}>
                        Mark all as read
                      </Text>
                    </TouchableOpacity>
                  )}
                  <ScrollView style={{ maxHeight: 300 }}>
                    {ltNotifications.map((item) => {
                      const iconMap: Record<string, string> = {
                        'training-created': 'calendar',
                        'training-modified': 'create',
                        'training-cancelled': 'close-circle',
                        'training-reminder': 'time',
                        'training-completed': 'checkmark-circle',
                        'venue-changed': 'location',
                        'trainer-changed': 'person',
                        'enrollment-approved': 'checkmark',
                        'enrollment-rejected': 'close',
                        'enrollment-request': 'people',
                        'quiz-assigned': 'book',
                        'quiz-completed': 'trophy',
                        'quiz-failed': 'warning',
                        'certificate-issued': 'ribbon',
                        'video-assigned': 'play-circle',
                        'video-completed': 'checkmark-done-circle',
                        'approval-request': 'hand-left',
                        'approval-approved': 'thumbs-up',
                        'approval-rejected': 'thumbs-down',
                      };
                      const iconName = iconMap[item.notif_type] || 'notifications';
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: '#F9FAFB',
                            backgroundColor: item.is_read ? 'transparent' : '#EFF6FF',
                          }}
                          onPress={() => handleLtNotificationClick(item)}
                        >
                          <View style={{
                            width: 32, height: 32, borderRadius: 16,
                            backgroundColor: item.is_read ? '#F3F4F6' : '#DBEAFE',
                            justifyContent: 'center', alignItems: 'center', marginRight: 12,
                          }}>
                            <Ionicons name={iconName as any} size={16} color={item.is_read ? '#9CA3AF' : '#2563EB'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: '#374151', fontWeight: item.is_read ? '400' : '600' }} numberOfLines={2}>
                              {item.title}
                            </Text>
                            {item.content_title ? (
                              <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                                {item.content_title}
                              </Text>
                            ) : null}
                            {item.message ? (
                              <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }} numberOfLines={2}>
                                {item.message}
                              </Text>
                            ) : null}
                            <Text style={{ fontSize: 10, color: '#D1D5DB', marginTop: 3 }}>
                              {new Date(item.created_at).toLocaleString('en-GB', {
                                hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
                              })}
                            </Text>
                          </View>
                          {!item.is_read && (
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', marginLeft: 8 }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}
            </View>
          )}
        </View>
      )}
    </ToggleContext.Provider>
  );
}
