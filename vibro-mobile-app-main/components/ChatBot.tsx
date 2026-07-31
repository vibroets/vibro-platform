import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import api from "../services";
import { ChatSocket } from "../services/chatSocket";
import { SecureStoreService, SecureStoreKeys } from "../services/secureStore";
import { chatNotificationService } from "../services/chatNotificationService";
import * as Linking from "expo-linking";
import { useSelector } from "react-redux";
import { RootState } from "../Redux/reducer/rootReducer";

const SERVER_BASE = "http://192.168.1.3:8000";

const getFullUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${SERVER_BASE}${url}`;
};

type Message = {
  id: number;
  sender: { id: number; username: string; first_name: string; last_name: string };
  message_type: string;
  content: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  duration: number | null;
  created_at: string;
};

type ChatGroup = {
  id: number;
  name: string;
  description: string | null;
  members: any[];
  last_message: Message | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
};

type OrgUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
};

type ViewMode = "bot" | "groups" | "chat" | "request";

const ChatBot = () => {
  const [visible, setVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("bot");
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [orgGroups, setOrgGroups] = useState<{ id: number; name: string; description: string }[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [requestTopic, setRequestTopic] = useState("");
  const [requestDesc, setRequestDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);
  const [notifPopup, setNotifPopup] = useState<{ group_id: number; group_name: string; sender: string; preview: string } | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [pickerType, setPickerType] = useState<"users" | "groups">("users");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const notifTimerRef = useRef<any>(null);
  const currentUser = useSelector((state: RootState) => state.user);

  const socketRef = useRef<ChatSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Draggable FAB
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;
  const FAB_SIZE = 56;
  const FAB_MARGIN = 16;
  const fabPos = useRef(new Animated.ValueXY({ x: screenWidth - FAB_SIZE - FAB_MARGIN, y: screenHeight - FAB_SIZE - 140 })).current;
  const fabCurrentPos = useRef({ x: screenWidth - FAB_SIZE - FAB_MARGIN, y: screenHeight - FAB_SIZE - 140 });
  const isDragging = useRef(false);

  const fabPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
      onPanResponderGrant: (evt) => {
        isDragging.current = false;
        fabPos.stopAnimation();
      },
      onPanResponderMove: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          isDragging.current = true;
        }
        const newX = Math.max(FAB_MARGIN, Math.min(screenWidth - FAB_SIZE - FAB_MARGIN, fabCurrentPos.current.x + gestureState.dx));
        const newY = Math.max(FAB_MARGIN, Math.min(screenHeight - FAB_SIZE - FAB_MARGIN, fabCurrentPos.current.y + gestureState.dy));
        fabPos.x.setValue(newX);
        fabPos.y.setValue(newY);
        fabCurrentPos.current = { x: newX, y: newY };
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (!isDragging.current) {
          setVisible(true);
          return;
        }
        const currentX = fabCurrentPos.current.x;
        const targetX = currentX < screenWidth / 2 ? FAB_MARGIN : screenWidth - FAB_SIZE - FAB_MARGIN;
        Animated.spring(fabPos.x, {
          toValue: targetX,
          useNativeDriver: false,
          tension: 50,
          friction: 8,
        }).start(() => {
          fabCurrentPos.current.x = targetX;
        });
      },
    })
  ).current;

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const res = await api.get("/chat/chat-groups/");
      setGroups(res.data);
    } catch (e: any) {
      console.warn("fetchGroups error:", e);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  // Fetch groups on mount to show unread count badge immediately
  useEffect(() => {
    fetchGroups();
    const interval = setInterval(() => {
      if (!visibleRef.current) {
        fetchGroups();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchGroups]);

  // Connect to global notification socket on mount
  const visibleRef = useRef(false);
  const selectedGroupRef = useRef<ChatGroup | null>(null);
  useEffect(() => { visibleRef.current = visible; }, [visible]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);

  useEffect(() => {
    chatNotificationService.setCallback((data) => {
      // Skip popup if user is currently viewing this exact chat group
      if (visibleRef.current && selectedGroupRef.current?.id === data.group_id) {
        return;
      }

      const msg = data.message;
      const senderName = msg?.sender
        ? ((msg.sender.first_name || "") + " " + (msg.sender.last_name || "")).trim() || msg.sender.username
        : "Someone";
      let preview = msg?.content || "";
      if (!preview) {
        if (msg?.message_type === "image") preview = "📷 Photo";
        else if (msg?.message_type === "voice") preview = "🎤 Voice message";
        else if (msg?.message_type === "video") preview = "🎥 Video";
        else if (msg?.message_type === "file") preview = "📎 " + (msg?.attachment_name || "File");
        else preview = "New message";
      }
      setNotifPopup({
        group_id: data.group_id,
        group_name: data.group_name,
        sender: senderName,
        preview,
      });
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      notifTimerRef.current = setTimeout(() => setNotifPopup(null), 5000);
    });
    chatNotificationService.connect();
    return () => {
      chatNotificationService.disconnect();
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    };
  }, []);

  // Refresh groups when a notification arrives (to update unread counts)
  useEffect(() => {
    if (notifPopup && !visible) {
      fetchGroups();
    }
  }, [notifPopup, visible, fetchGroups]);

  const fetchMyRequests = useCallback(async () => {
    try {
      const res = await api.get("/chat/group-requests/");
      setMyRequests(res.data);
    } catch (e) {
      console.warn("fetchMyRequests error:", e);
    }
  }, []);

  const fetchOrgUsers = useCallback(async () => {
    try {
      const res = await api.get("/chat/chat/users/");
      setOrgUsers(res.data);
    } catch (e) {
      console.warn("fetchOrgUsers error:", e);
    }
  }, []);

  const fetchOrgGroups = useCallback(async () => {
    try {
      const res = await api.get("/chat/chat/groups/");
      setOrgGroups(res.data);
    } catch (e) {
      console.warn("fetchOrgGroups error:", e);
    }
  }, []);

  const fetchMessages = useCallback(async (groupId: number) => {
    setMessagesLoading(true);
    try {
      const res = await api.get(`/chat/chat-groups/${groupId}/messages/`);
      setMessages(res.data);
      await api.post(`/chat/chat-groups/${groupId}/mark_read/`);
    } catch (e) {
      console.warn("fetchMessages error:", e);
    } finally {
      setMessagesLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 300);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 600);
    }
  }, []);

  const connectSocket = useCallback(async (groupId: number) => {
    const authInfo = await SecureStoreService.get(SecureStoreKeys.AUTH_INFO) as any;
    const token = authInfo?.access;
    if (!token) return;
    socketRef.current?.disconnect();
    const socket = new ChatSocket(
      groupId,
      token,
      (data) => {
        if (data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      },
      () => setConnected(true),
      () => setConnected(false)
    );
    socket.connect();
    socketRef.current = socket;
  }, []);

  const disconnectSocket = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, []);

  const openChat = useCallback((group: ChatGroup) => {
    setSelectedGroup(group);
    setViewMode("chat");
    fetchMessages(group.id);
    connectSocket(group.id);
  }, [fetchMessages, connectSocket]);

  const closeChat = useCallback(() => {
    disconnectSocket();
    setSelectedGroup(null);
    setMessages([]);
    setViewMode("groups");
    fetchGroups();
  }, [disconnectSocket, fetchGroups]);

  const sendMessage = useCallback(async (msgType: string, content: string, attachment?: any, attachmentName?: string, duration?: number) => {
    if (!selectedGroup) return;
    try {
      const formData = new FormData();
      formData.append("message_type", msgType);
      if (content) formData.append("content", content);
      if (attachment) {
        formData.append("attachment", attachment);
        if (attachmentName) formData.append("attachment_name", attachmentName);
      }
      if (duration) formData.append("duration", String(duration));

      const res = await api.post(`/chat/chat-groups/${selectedGroup.id}/send_message/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data.id)) return prev;
        return [...prev, res.data];
      });
    } catch (e: any) {
      Alert.alert("Error", "Failed to send message");
    }
  }, [selectedGroup]);

  const handleSendText = useCallback(() => {
    if (!inputText.trim()) return;
    sendMessage("text", inputText.trim());
    setInputText("");
    setMentionQuery(null);
  }, [inputText, sendMessage]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    const atMatch = text.match(/@([\w\s]*)$/);
    if (atMatch && selectedGroup) {
      setMentionQuery(atMatch[1].toLowerCase());
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (name: string) => {
    const ZWSP = "\u200B";
    const newText = inputText.replace(/@([\w\s]*)$/, `@${ZWSP}${name}${ZWSP} `);
    setInputText(newText);
    setMentionQuery(null);
  };

  const mentionList = useMemo(() => {
    if (mentionQuery === null || !selectedGroup) return [];
    return (selectedGroup.members || []).filter((m: any) => {
      const fullName = `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.username || "";
      return fullName.toLowerCase().includes(mentionQuery);
    }).slice(0, 8);
  }, [mentionQuery, selectedGroup]);

  const requestCameraPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos/videos");
      return false;
    }
    return true;
  }, []);

  const handlePickImage = useCallback(async (useCamera: boolean) => {
    try {
      if (useCamera && !(await requestCameraPermission())) return;
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
          });
      if (!result.canceled && result.assets[0]) {
        setSendingFile(true);
        const asset = result.assets[0];
        const file = {
          uri: asset.uri,
          type: "image/jpeg",
          name: asset.fileName || "image.jpg",
        };
        await sendMessage("image", "", file, asset.fileName || "image.jpg");
        setSendingFile(false);
      }
    } catch (e) {
      setSendingFile(false);
    }
  }, [sendMessage, requestCameraPermission]);

  const handlePickVideo = useCallback(async (useCamera: boolean) => {
    try {
      if (useCamera && !(await requestCameraPermission())) return;
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 0.7,
          });
      if (!result.canceled && result.assets[0]) {
        setSendingFile(true);
        const asset = result.assets[0];
        const file = {
          uri: asset.uri,
          type: "video/mp4",
          name: asset.fileName || "video.mp4",
        };
        await sendMessage("video", "", file, asset.fileName || "video.mp4");
        setSendingFile(false);
      }
    } catch (e) {
      setSendingFile(false);
    }
  }, [sendMessage, requestCameraPermission]);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      if (!result.canceled && result.assets[0]) {
        setSendingFile(true);
        const asset = result.assets[0];
        const file = {
          uri: asset.uri,
          type: asset.mimeType || "application/octet-stream",
          name: asset.name,
        };
        await sendMessage("file", "", file, asset.name);
        setSendingFile(false);
      }
    } catch (e) {
      setSendingFile(false);
    }
  }, [sendMessage]);

  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HighQuality
      );
      recordingRef.current = recording;
      setRecording(true);
    } catch (e) {
      Alert.alert("Error", "Failed to start recording");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      setRecording(false);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (uri) {
        setSendingFile(true);
        const file = {
          uri,
          type: "audio/m4a",
          name: "voice.m4a",
        };
        await sendMessage("voice", "", file, "voice.m4a");
        setSendingFile(false);
      }
      recordingRef.current = null;
    } catch (e) {
      setSendingFile(false);
      setRecording(false);
    }
  }, [sendMessage]);

  const submitGroupRequest = useCallback(async () => {
    if (!requestTopic.trim()) {
      Alert.alert("Required", "Please enter a topic");
      return;
    }
    if (selectedMembers.length === 0 && selectedGroups.length === 0) {
      Alert.alert("Required", "Please select at least one member or group");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/chat/group-requests/", {
        topic: requestTopic.trim(),
        description: requestDesc.trim(),
        proposed_member_ids: selectedMembers,
        group_ids: selectedGroups,
      });
      Alert.alert("Success", "Group request submitted. Admin will review and approve.");
      setRequestTopic("");
      setRequestDesc("");
      setSelectedMembers([]);
      setSelectedGroups([]);
      setViewMode("bot");
      fetchMyRequests();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }, [requestTopic, requestDesc, selectedMembers, selectedGroups, fetchMyRequests]);

  const toggleMember = useCallback((userId: number) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }, []);

  const toggleGroup = useCallback((groupId: number) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  }, []);

  useEffect(() => {
    if (visible) {
      fetchGroups();
      fetchMyRequests();
    }
  }, [visible, fetchGroups, fetchMyRequests]);

  useEffect(() => {
    if (viewMode === "request") {
      if (orgUsers.length === 0) fetchOrgUsers();
      if (orgGroups.length === 0) fetchOrgGroups();
    }
  }, [viewMode, orgUsers, orgGroups, fetchOrgUsers, fetchOrgGroups]);

  useEffect(() => {
    if (messages.length > 0 && viewMode === "chat") {
      const timer1 = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 300);
      const timer2 = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 600);
      return () => { clearTimeout(timer1); clearTimeout(timer2); };
    }
  }, [messages, viewMode]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, [disconnectSocket]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const getSenderName = (msg: Message) => {
    const fn = msg.sender?.first_name || "";
    const ln = msg.sender?.last_name || "";
    return (fn + " " + ln).trim() || msg.sender?.username || "Unknown";
  };

  const renderMessageContent = (content: string, isMe: boolean) => {
    const ZWSP = "\u200B";
    const parts = content.split(new RegExp(`@${ZWSP}([^${ZWSP}]+)${ZWSP}`, "g"));
    return (
      <Text style={[styles.msgText, isMe && styles.msgTextMe]}>
        {parts.map((part, i) => {
          if (i % 2 === 1) {
            return <Text key={i} style={{ fontWeight: "700", color: isMe ? "#BFDBFE" : "#2563EB" }}>@{part}</Text>;
          }
          return <Text key={i}>{part}</Text>;
        })}
      </Text>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender?.id === currentUser?.id;
    const isSystem = item.message_type === "system";
    const fullUrl = getFullUrl(item.attachment_url);

    if (isSystem) {
      return (
        <View style={styles.systemMsg}>
          <Text style={styles.systemMsgText}>{item.content}</Text>
        </View>
      );
    }

    const openAttachment = () => {
      if (fullUrl) Linking.openURL(fullUrl);
    };

    return (
      <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
        {!isMe && <Text style={styles.msgSender}>{getSenderName(item)}</Text>}
        {item.content ? renderMessageContent(item.content, isMe) : null}
        {fullUrl && item.message_type === "image" && (
          <TouchableOpacity onPress={openAttachment} activeOpacity={0.8}>
            <Image source={{ uri: fullUrl }} style={styles.msgImage} resizeMode="cover" />
          </TouchableOpacity>
        )}
        {fullUrl && item.message_type === "voice" && (
          <TouchableOpacity style={styles.voiceMsg} onPress={openAttachment} activeOpacity={0.7}>
            <Ionicons name="play-circle" size={24} color={isMe ? "#fff" : "#2563EB"} />
            <Text style={[styles.voiceText, isMe && styles.msgTextMe]}>
              Voice message{item.duration ? ` (${Math.round(item.duration)}s)` : ""}
            </Text>
          </TouchableOpacity>
        )}
        {fullUrl && (item.message_type === "file" || item.message_type === "video") && (
          <TouchableOpacity style={styles.fileMsg} onPress={openAttachment} activeOpacity={0.7}>
            <Ionicons name={item.message_type === "video" ? "videocam" : "document-attach"} size={18} color={isMe ? "#fff" : "#2563EB"} />
            <Text style={[styles.fileName, isMe && styles.msgTextMe]} numberOfLines={1}>
              {item.attachment_name || "Attachment"}
            </Text>
            <Ionicons name="open-outline" size={14} color={isMe ? "#fff" : "#9CA3AF"} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        )}
        <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{formatTime(item.created_at)}</Text>
      </View>
    );
  };

  const renderGroup = ({ item }: { item: ChatGroup }) => (
    <TouchableOpacity style={styles.groupCard} onPress={() => openChat(item)}>
      <View style={styles.groupAvatar}>
        <Ionicons name="chatbubbles" size={22} color="#2563EB" />
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
        {item.last_message ? (
          <Text style={styles.groupLastMsg} numberOfLines={1}>
            {item.last_message.content || item.last_message.attachment_name || `[${item.last_message.message_type}]`}
          </Text>
        ) : (
          <Text style={styles.groupNoMsg}>No messages yet</Text>
        )}
      </View>
      {item.unread_count > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread_count > 9 ? "9+" : item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <>
      {/* Floating Chat Icon (Draggable) */}
      {!visible && (
        <Animated.View
          {...fabPanResponder.panHandlers}
          style={[styles.fab, { left: fabPos.x, top: fabPos.y, bottom: undefined, right: undefined }]}
        >
          <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
          {groups.reduce((sum, g) => sum + (g.unread_count || 0), 0) > 0 && (
            <View style={styles.fabBadge}>
              <Text style={styles.fabBadgeText}>
                {groups.reduce((sum, g) => sum + (g.unread_count || 0), 0) > 9 ? "9+" : groups.reduce((sum, g) => sum + (g.unread_count || 0), 0)}
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* New Message Notification Popup */}
      {notifPopup && !visible && (
        <TouchableOpacity
          style={styles.notifPopup}
          activeOpacity={0.9}
          onPress={async () => {
            const groupId = notifPopup.group_id;
            setNotifPopup(null);
            setVisible(true);
            try {
              const res = await api.get("/chat/chat-groups/");
              const fetchedGroups = res.data;
              setGroups(fetchedGroups);
              const targetGroup = fetchedGroups.find((g: ChatGroup) => g.id === groupId);
              if (targetGroup) {
                openChat(targetGroup);
              } else {
                setViewMode("groups");
              }
            } catch (e) {
              console.warn("Notification tap fetchGroups error:", e);
              setViewMode("groups");
            }
          }}
        >
          <View style={styles.notifPopupIcon}>
            <Ionicons name="chatbubble" size={20} color="#fff" />
          </View>
          <View style={styles.notifPopupBody}>
            <Text style={styles.notifPopupTitle} numberOfLines={1}>
              {notifPopup.group_name}
            </Text>
            <Text style={styles.notifPopupSender} numberOfLines={1}>
              {notifPopup.sender}
            </Text>
            <Text style={styles.notifPopupPreview} numberOfLines={1}>
              {notifPopup.preview}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notifPopupClose}
            onPress={() => setNotifPopup(null)}
          >
            <Ionicons name="close" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Full Chat Modal */}
      <Modal visible={visible} animationType="slide" onRequestClose={() => { disconnectSocket(); setVisible(false); setViewMode("bot"); }}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity
              onPress={() => {
                if (viewMode === "chat") {
                  closeChat();
                } else if (viewMode === "request" || viewMode === "groups") {
                  setViewMode("bot");
                } else {
                  disconnectSocket();
                  setVisible(false);
                }
              }}
              style={styles.headerBtn}
            >
              <Ionicons name={viewMode === "bot" ? "close" : "arrow-back"} size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {viewMode === "bot" ? "Vibro Assistant" : viewMode === "groups" ? "My Groups" : viewMode === "request" ? "Request Group" : selectedGroup?.name || "Chat"}
            </Text>
            {viewMode === "chat" && (
              <View style={[styles.connDot, connected ? styles.connOn : styles.connOff]} />
            )}
          </View>

          {/* Bot Home */}
          {viewMode === "bot" && (
            <ScrollView style={styles.botContainer} contentContainerStyle={{ padding: 20 }}>
              <View style={styles.botGreeting}>
                <View style={styles.botIcon}>
                  <Ionicons name="sparkles" size={32} color="#2563EB" />
                </View>
                <Text style={styles.botHello}>Hi! How can I help you?</Text>
                <Text style={styles.botSubtext}>Choose an option below to get started.</Text>
              </View>

              <TouchableOpacity style={styles.botOption} onPress={() => setViewMode("groups")}>
                <View style={[styles.botOptionIcon, { backgroundColor: "#EFF6FF" }]}>
                  <Ionicons name="chatbubbles-outline" size={24} color="#2563EB" />
                </View>
                <View style={styles.botOptionText}>
                  <Text style={styles.botOptionTitle}>My Groups</Text>
                  <Text style={styles.botOptionDesc}>View and chat in your existing groups</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.botOption} onPress={() => setViewMode("request")}>
                <View style={[styles.botOptionIcon, { backgroundColor: "#F3E8FF" }]}>
                  <Ionicons name="people-outline" size={24} color="#7C3AED" />
                </View>
                <View style={styles.botOptionText}>
                  <Text style={styles.botOptionTitle}>Request Group Chat</Text>
                  <Text style={styles.botOptionDesc}>Ask admin to create a new discussion group</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
              </TouchableOpacity>

              {/* Pending Requests */}
              {myRequests.length > 0 && (
                <View style={styles.requestsSection}>
                  <Text style={styles.requestsTitle}>Your Requests</Text>
                  {myRequests.map((req) => (
                    <View key={req.id} style={styles.requestItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.requestTopic}>{req.topic}</Text>
                        <Text style={[styles.requestStatusBase, { color: req.status === "approved" ? "#059669" : req.status === "rejected" ? "#DC2626" : "#D97706" }]}>{req.status.toUpperCase()}</Text>
                      </View>
                      {req.created_chat_group && req.status === "approved" && (
                        <TouchableOpacity
                          style={styles.openGroupBtn}
                          onPress={() => openChat(req.created_chat_group)}
                        >
                          <Text style={styles.openGroupBtnText}>Open</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}

          {/* Groups List */}
          {viewMode === "groups" && (
            <View style={styles.groupsContainer}>
              {groupsLoading ? (
                <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
              ) : groups.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No groups yet</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => setViewMode("request")}>
                    <Text style={styles.emptyBtnText}>Request a Group Chat</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={groups}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderGroup}
                  contentContainerStyle={{ padding: 16 }}
                  onRefresh={fetchGroups}
                  refreshing={groupsLoading}
                />
              )}
            </View>
          )}

          {/* Request Form */}
          {viewMode === "request" && (
            <KeyboardAvoidingView
              style={styles.requestContainer}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={styles.formLabel}>Topic *</Text>
                <TextInput
                  style={styles.formInput}
                  value={requestTopic}
                  onChangeText={setRequestTopic}
                  placeholder="e.g., Panel Repair Discussion"
                  placeholderTextColor="#9CA3AF"
                />

                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, { height: 80 }]}
                  value={requestDesc}
                  onChangeText={setRequestDesc}
                  placeholder="Brief description of what you want to discuss"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  textAlignVertical="top"
                />

                <Text style={styles.formLabel}>Select Members *</Text>
                <Text style={styles.formHint}>Choose colleagues and/or groups to include</Text>

                {orgGroups.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.formHint, { fontWeight: "600", color: "#374151", marginBottom: 4 }]}>Groups</Text>
                    <TouchableOpacity
                      style={styles.formInput}
                      onPress={() => { setMemberSearch(""); setPickerType("groups"); setShowMemberPicker(true); }}
                    >
                      <Text style={{ color: "#9CA3AF", fontSize: 14 }} numberOfLines={1}>
                        {selectedGroups.length > 0 ? `${selectedGroups.length} group(s) selected` : "Select groups..."}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#9CA3AF" style={{ position: "absolute", right: 12, top: 14 }} />
                    </TouchableOpacity>
                    {selectedGroups.map((gid) => {
                      const g = orgGroups.find((x) => x.id === gid);
                      if (!g) return null;
                      return (
                        <View key={`g-${gid}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 3 }}>
                          <Text style={{ fontSize: 13, color: "#059669" }}>👥 {g.name}</Text>
                          <TouchableOpacity onPress={() => toggleGroup(gid)}>
                            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.formHint, { fontWeight: "600", color: "#374151", marginBottom: 4 }]}>Users</Text>
                  <TouchableOpacity
                    style={styles.formInput}
                    onPress={() => { setMemberSearch(""); setPickerType("users"); setShowMemberPicker(true); }}
                  >
                    <Text style={{ color: "#9CA3AF", fontSize: 14 }} numberOfLines={1}>
                      {selectedMembers.length > 0 ? `${selectedMembers.length} user(s) selected` : "Select users..."}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#9CA3AF" style={{ position: "absolute", right: 12, top: 14 }} />
                  </TouchableOpacity>
                  {selectedMembers.map((uid) => {
                    const u = orgUsers.find((x) => x.id === uid);
                    if (!u) return null;
                    return (
                      <View key={`u-${uid}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 3 }}>
                        <Text style={{ fontSize: 13, color: "#2563EB" }}>👤 {(u.first_name + " " + u.last_name).trim() || u.username}</Text>
                        <TouchableOpacity onPress={() => toggleMember(uid)}>
                          <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={submitGroupRequest}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit Request</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          {/* Chat Room */}
          {viewMode === "chat" && selectedGroup && (
            <View style={styles.chatRoomContainer}>
              {messagesLoading ? (
                <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderMessage}
                  contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
                  onContentSizeChange={() => {
                    if (messages.length > 0) {
                      flatListRef.current?.scrollToEnd({ animated: false });
                    }
                  }}
                  onLayout={() => {
                    if (messages.length > 0) {
                      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
                    }
                  }}
                />
              )}

              {/* Input Bar */}
              <View style={styles.inputBar}>
                <TouchableOpacity style={styles.inputBtn} onPress={() => {
                  Alert.alert(
                    "Upload Photo",
                    "Choose an option",
                    [
                      { text: "Take Photo", onPress: () => handlePickImage(true) },
                      { text: "Choose from Gallery", onPress: () => handlePickImage(false) },
                      { text: "Cancel", style: "cancel" },
                    ]
                  );
                }} disabled={sendingFile}>
                  <Ionicons name="image-outline" size={22} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.inputBtn} onPress={() => {
                  Alert.alert(
                    "Upload Video",
                    "Choose an option",
                    [
                      { text: "Record Video", onPress: () => handlePickVideo(true) },
                      { text: "Choose from Gallery", onPress: () => handlePickVideo(false) },
                      { text: "Cancel", style: "cancel" },
                    ]
                  );
                }} disabled={sendingFile}>
                  <Ionicons name="videocam-outline" size={22} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.inputBtn} onPress={handlePickFile} disabled={sendingFile}>
                  <Ionicons name="attach-outline" size={22} color="#6B7280" />
                </TouchableOpacity>

                <TextInput
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={handleInputChange}
                  placeholder="Type a message... (use @ to mention)"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={2000}
                />

                {mentionList.length > 0 && (
                  <View style={{
                    position: "absolute",
                    bottom: 56,
                    left: 0,
                    right: 0,
                    backgroundColor: "#fff",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    maxHeight: 200,
                    elevation: 5,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                  }}>
                    {mentionList.map((m: any) => {
                      const fullName = `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.username || "";
                      return (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => insertMention(fullName)}
                          style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
                        >
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#DBEAFE", justifyContent: "center", alignItems: "center", marginRight: 10 }}>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: "#2563EB" }}>{fullName.charAt(0).toUpperCase()}</Text>
                          </View>
                          <Text style={{ fontSize: 14, color: "#374151" }}>{fullName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {inputText.trim() ? (
                  <TouchableOpacity style={styles.sendBtn} onPress={handleSendText}>
                    <Ionicons name="send" size={20} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.micBtn, recording && styles.micBtnActive]}
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                  >
                    <Ionicons name={recording ? "stop" : "mic"} size={20} color={recording ? "#fff" : "#6B7280"} />
                  </TouchableOpacity>
                )}
              </View>

              {sendingFile && (
                <View style={styles.sendingOverlay}>
                  <ActivityIndicator color="#2563EB" size="small" />
                  <Text style={styles.sendingText}>Sending...</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* Member Picker Modal */}
      <Modal visible={showMemberPicker} animationType="slide" onRequestClose={() => setShowMemberPicker(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
              {pickerType === "groups" ? "Select Groups" : "Select Users"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  if (pickerType === "groups") {
                    if (selectedGroups.length === orgGroups.length) {
                      setSelectedGroups([]);
                    } else {
                      setSelectedGroups(orgGroups.map((g) => g.id));
                    }
                  } else {
                    if (selectedMembers.length === orgUsers.length) {
                      setSelectedMembers([]);
                    } else {
                      setSelectedMembers(orgUsers.map((u) => u.id));
                    }
                  }
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#2563EB" }}>
                  {pickerType === "groups"
                    ? selectedGroups.length === orgGroups.length ? "Deselect All" : "Select All"
                    : selectedMembers.length === orgUsers.length ? "Deselect All" : "Select All"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowMemberPicker(false)}>
                <Ionicons name="checkmark-done" size={24} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 12 }}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14 }}
                value={memberSearch}
                onChangeText={setMemberSearch}
                placeholder={pickerType === "groups" ? "Search groups..." : "Search users..."}
                placeholderTextColor="#9CA3AF"
              />
              {memberSearch.length > 0 && (
                <TouchableOpacity onPress={() => setMemberSearch("")}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <FlatList
            data={pickerType === "groups"
              ? orgGroups.map((g) => ({ id: g.id, name: g.name, type: "group" as const }))
              : orgUsers.map((u) => ({ id: u.id, name: ((u.first_name + " " + u.last_name).trim() || u.username), type: "user" as const }))
            }
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={({ item }: { item: any }) => {
              const isSel = item.type === "group" ? selectedGroups.includes(item.id) : selectedMembers.includes(item.id);
              if (memberSearch && !item.name.toLowerCase().includes(memberSearch.toLowerCase())) return null;
              return (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
                  onPress={() => item.type === "group" ? toggleGroup(item.id) : toggleMember(item.id)}
                >
                  <Ionicons
                    name={isSel ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={isSel ? (item.type === "group" ? "#059669" : "#2563EB") : "#D1D5DB"}
                  />
                  <Ionicons
                    name={item.type === "group" ? "people" : "person"}
                    size={18}
                    color={item.type === "group" ? "#059669" : "#2563EB"}
                    style={{ marginLeft: 8, marginRight: 8 }}
                  />
                  <Text style={{ fontSize: 14, color: "#111827", flex: 1 }}>{item.name}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 70,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  fabBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  fabBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  notifPopup: {
    position: "absolute",
    top: 60,
    right: 16,
    left: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 1000,
  },
  notifPopupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notifPopupBody: {
    flex: 1,
  },
  notifPopupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  notifPopupSender: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
    marginTop: 2,
  },
  notifPopupPreview: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  notifPopupClose: {
    padding: 4,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 56,
    backgroundColor: "#2563EB",
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    marginLeft: 8,
  },
  connDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connOn: {
    backgroundColor: "#34D399",
  },
  connOff: {
    backgroundColor: "#F87171",
  },
  // Bot Home
  botContainer: {
    flex: 1,
  },
  botGreeting: {
    alignItems: "center",
    marginBottom: 24,
  },
  botIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  botHello: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  botSubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  botOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  botOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  botOptionText: {
    flex: 1,
  },
  botOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  botOptionDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  requestsSection: {
    marginTop: 8,
  },
  requestsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  requestTopic: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  requestStatusBase: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  openGroupBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  openGroupBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  // Groups
  groupsContainer: {
    flex: 1,
  },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  groupLastMsg: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  groupNoMsg: {
    fontSize: 12,
    color: "#D1D5DB",
    marginTop: 2,
  },
  unreadBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 12,
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  // Request Form
  requestContainer: {
    flex: 1,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    marginBottom: 16,
  },
  formHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 10,
  },
  membersList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  memberChipSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  memberName: {
    fontSize: 13,
    color: "#374151",
    marginLeft: 6,
  },
  memberNameSelected: {
    color: "#2563EB",
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  // Chat Room
  chatRoomContainer: {
    flex: 1,
  },
  systemMsg: {
    alignSelf: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginVertical: 8,
    maxWidth: "80%",
  },
  systemMsgText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  msgBubble: {
    maxWidth: "75%",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 4,
  },
  msgBubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: "#2563EB",
  },
  msgBubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  msgSender: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 2,
  },
  msgText: {
    fontSize: 14,
    color: "#374151",
  },
  msgTextMe: {
    color: "#fff",
  },
  msgImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginTop: 6,
  },
  voiceMsg: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  voiceText: {
    fontSize: 13,
    color: "#374151",
    marginLeft: 6,
  },
  fileMsg: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  fileName: {
    fontSize: 13,
    color: "#374151",
    marginLeft: 6,
    flex: 1,
  },
  msgTime: {
    fontSize: 10,
    color: "#D1D5DB",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  msgTimeMe: {
    color: "rgba(255,255,255,0.7)",
  },
  // Input Bar
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  inputBtn: {
    padding: 6,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
    marginHorizontal: 4,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  micBtnActive: {
    backgroundColor: "#EF4444",
  },
  sendingOverlay: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendingText: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 8,
  },
});

export default ChatBot;
