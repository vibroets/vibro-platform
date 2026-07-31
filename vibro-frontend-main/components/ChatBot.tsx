"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { selectUser, selectAccessToken } from "@/redux/slices/authSlice";
import {
  MessageSquare,
  X,
  Send,
  Users,
  Plus,
  ArrowLeft,
  Image as ImageIcon,
  Paperclip,
  Mic,
  Video as VideoIcon,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { useToast } from "@/hooks/use-toast";

const SERVER_BASE = "http://localhost:8000";

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

export default function ChatBot() {
  const [open, setOpen] = useState(false);
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
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [notifPopup, setNotifPopup] = useState<{ group_id: number; group_name: string; sender: string; preview: string } | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const user = useSelector(selectUser);
  const accessToken = useSelector(selectAccessToken);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.is_superadmin === true || user?.is_admin === true;

  const wsRef = useRef<WebSocket | null>(null);
  const notifWsRef = useRef<WebSocket | null>(null);
  const notifTimerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const res = await axiosInstance.get("/chat/chat-groups/");
      setGroups(res.data);
    } catch (e) {
      console.warn("fetchGroups error:", e);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const fetchMyRequests = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/chat/group-requests/");
      setMyRequests(res.data);
    } catch (e) {
      console.warn("fetchMyRequests error:", e);
    }
  }, []);

  const fetchPendingRequests = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/chat/group-requests/");
      const pending = res.data.filter((r: any) => r.status === "pending");
      setPendingRequests(pending);
    } catch (e) {
      console.warn("fetchPendingRequests error:", e);
    }
  }, []);

  const fetchOrgUsers = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/chat/chat/users/");
      setOrgUsers(res.data);
    } catch (e) {
      console.warn("fetchOrgUsers error:", e);
    }
  }, []);

  const fetchOrgGroups = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/chat/chat/groups/");
      setOrgGroups(res.data);
    } catch (e) {
      console.warn("fetchOrgGroups error:", e);
    }
  }, []);

  const fetchMessages = useCallback(async (groupId: number) => {
    setMessagesLoading(true);
    try {
      const res = await axiosInstance.get(`/chat/chat-groups/${groupId}/messages/`);
      setMessages(res.data);
      await axiosInstance.post(`/chat/chat-groups/${groupId}/mark_read/`);
    } catch (e) {
      console.warn("fetchMessages error:", e);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const connectSocket = useCallback((groupId: number) => {
    const token = accessToken || localStorage.getItem("access_token");
    if (!token) return;
    const wsUrl = `ws://localhost:8000/ws/chat/${groupId}/?token=${token}`;
    wsRef.current?.close();
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => setConnected(true);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      } catch (e) {
        console.warn("WS parse error:", e);
      }
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    wsRef.current = ws;
  }, [accessToken]);

  const disconnectSocket = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
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

  const sendMessage = useCallback(async (msgType: string, content: string, file?: File) => {
    if (!selectedGroup) return;
    try {
      const formData = new FormData();
      formData.append("message_type", msgType);
      if (content) formData.append("content", content);
      if (file) {
        formData.append("attachment", file);
        formData.append("attachment_name", file.name);
      }
      const res = await axiosInstance.post(
        `/chat/chat-groups/${selectedGroup.id}/send_message/`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data.id)) return prev;
        return [...prev, res.data];
      });
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    }
  }, [selectedGroup, toast]);

  const handleSendText = useCallback(() => {
    if (!inputText.trim()) return;
    sendMessage("text", inputText.trim());
    setInputText("");
  }, [inputText, sendMessage]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file) sendMessage(type, "", file);
    e.target.value = "";
  }, [sendMessage]);

  const submitGroupRequest = useCallback(async () => {
    if (!requestTopic.trim()) {
      toast({ title: "Required", description: "Please enter a topic", variant: "destructive" });
      return;
    }
    if (selectedMembers.length === 0) {
      toast({ title: "Required", description: "Select at least one member", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await axiosInstance.post("/chat/group-requests/", {
        topic: requestTopic.trim(),
        description: requestDesc.trim(),
        proposed_member_ids: selectedMembers,
      });
      toast({ title: "Success", description: "Group request submitted for admin approval" });
      setRequestTopic("");
      setRequestDesc("");
      setSelectedMembers([]);
      setShowRequestModal(false);
      fetchMyRequests();
    } catch (e: any) {
      toast({ title: "Error", description: e?.response?.data?.error || "Failed to submit", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [requestTopic, requestDesc, selectedMembers, fetchMyRequests, toast]);

  const approveRequest = useCallback(async (reqId: number) => {
    try {
      await axiosInstance.post(`/chat/group-requests/${reqId}/approve/`);
      toast({ title: "Approved", description: "Chat group created successfully" });
      fetchPendingRequests();
      fetchGroups();
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to approve", variant: "destructive" });
    }
  }, [fetchPendingRequests, fetchGroups, toast]);

  const rejectRequest = useCallback(async (reqId: number) => {
    try {
      await axiosInstance.post(`/chat/group-requests/${reqId}/reject/`);
      toast({ title: "Rejected", description: "Group request rejected" });
      fetchPendingRequests();
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to reject", variant: "destructive" });
    }
  }, [fetchPendingRequests, toast]);

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

  const createChatGroup = useCallback(async () => {
    if (!requestTopic.trim()) {
      toast({ title: "Required", description: "Please enter a group name", variant: "destructive" });
      return;
    }
    if (selectedMembers.length === 0 && selectedGroups.length === 0) {
      toast({ title: "Required", description: "Select at least one member or group", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await axiosInstance.post("/chat/create-group/", {
        name: requestTopic.trim(),
        description: requestDesc.trim(),
        member_ids: selectedMembers,
        group_ids: selectedGroups,
      });
      toast({ title: "Success", description: "Chat group created successfully" });
      setRequestTopic("");
      setRequestDesc("");
      setSelectedMembers([]);
      setSelectedGroups([]);
      setShowCreateModal(false);
      fetchGroups();
    } catch (e: any) {
      toast({ title: "Error", description: e?.response?.data?.error || "Failed to create group", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [requestTopic, requestDesc, selectedMembers, selectedGroups, fetchGroups, toast]);

  useEffect(() => {
    if (open) {
      fetchGroups();
      fetchMyRequests();
      fetchPendingRequests();
    }
  }, [open, fetchGroups, fetchMyRequests, fetchPendingRequests]);

  useEffect(() => {
    if ((viewMode === "request" || showCreateModal) && orgUsers.length === 0) {
      fetchOrgUsers();
    }
    if ((viewMode === "request" || showCreateModal) && orgGroups.length === 0) {
      fetchOrgGroups();
    }
  }, [viewMode, showCreateModal, orgUsers, orgGroups, fetchOrgUsers, fetchOrgGroups]);

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, viewMode]);

  useEffect(() => {
    return () => disconnectSocket();
  }, [disconnectSocket]);

  // Global notification WebSocket — connects on mount, shows toast on new messages
  useEffect(() => {
    let reconnectTimer: any = null;
    let shouldConnect = true;

    const connectWs = () => {
      const token = accessToken || localStorage.getItem("access_token");
      if (!token || !shouldConnect) return;

      const wsUrl = `ws://localhost:8000/ws/chat/notifications/?token=${token}`;
      const ws = new WebSocket(wsUrl);
      notifWsRef.current = ws;

      ws.onopen = () => {
        console.log("[ChatNotif] WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message_notification") {
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
            if (!open) {
              fetchGroups();
            }
            if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
            notifTimerRef.current = setTimeout(() => setNotifPopup(null), 5000);
          }
        } catch (e) {
          console.warn("Notif WS parse error:", e);
        }
      };

      ws.onclose = () => {
        console.log("[ChatNotif] WebSocket closed, reconnecting in 5s");
        if (shouldConnect) {
          reconnectTimer = setTimeout(connectWs, 5000);
        }
      };

      ws.onerror = () => {
        console.warn("[ChatNotif] WebSocket error");
      };
    };

    connectWs();

    return () => {
      shouldConnect = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (notifWsRef.current) {
        notifWsRef.current.close();
        notifWsRef.current = null;
      }
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    };
  }, [accessToken, fetchGroups]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const getSenderName = (msg: Message) => {
    const fn = msg.sender?.first_name || "";
    const ln = msg.sender?.last_name || "";
    return (fn + " " + ln).trim() || msg.sender?.username || "Unknown";
  };

  const getStatusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle2 className="w-3 h-3 text-green-600" />;
    if (status === "rejected") return <XCircle className="w-3 h-3 text-red-600" />;
    return <Clock className="w-3 h-3 text-amber-600" />;
  };

  const renderContent = (content: string, isMe: boolean) => {
    if (!content) return null;
    const ZWSP = "\u200B";
    const parts = content.split(new RegExp(`@${ZWSP}([^${ZWSP}]+)${ZWSP}`, "g"));
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <span key={i} className={isMe ? "text-blue-200 font-semibold" : "text-blue-600 font-semibold"}>@{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    const atMatch = val.match(/@([\w\s]*)$/);
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

  const mentionList = React.useMemo(() => {
    if (mentionQuery === null || !selectedGroup) return [];
    return selectedGroup.members.filter((m: any) => {
      const fullName = `${m.first_name} ${m.last_name}`.trim() || m.username;
      return fullName.toLowerCase().includes(mentionQuery);
    }).slice(0, 8);
  }, [mentionQuery, selectedGroup]);

  return (
    <>
      {/* Floating Chat Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <MessageSquare className="w-6 h-6" />
          {groups.reduce((sum, g) => sum + (g.unread_count || 0), 0) > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold border-2 border-white">
              {groups.reduce((sum, g) => sum + (g.unread_count || 0), 0) > 9 ? "9+" : groups.reduce((sum, g) => sum + (g.unread_count || 0), 0)}
            </span>
          )}
          {pendingRequests.length > 0 && isAdmin && groups.reduce((sum, g) => sum + (g.unread_count || 0), 0) === 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </button>
      )}

      {/* New Message Notification Popup */}
      {notifPopup && !open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 flex items-center gap-3 cursor-pointer animate-in slide-in-from-bottom-2"
          onClick={async () => {
            const groupId = notifPopup.group_id;
            setNotifPopup(null);
            setOpen(true);
            try {
              const res = await axiosInstance.get("/chat/chat-groups/");
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
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-900 truncate">{notifPopup.group_name}</p>
            <p className="text-xs font-semibold text-blue-600 truncate">{notifPopup.sender}</p>
            <p className="text-xs text-gray-500 truncate">{notifPopup.preview}</p>
          </div>
          <button
            className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); setNotifPopup(null); }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              {viewMode !== "bot" && (
                <button
                  onClick={() => {
                    if (viewMode === "chat") closeChat();
                    else setViewMode("bot");
                  }}
                  className="hover:bg-blue-700 rounded p-1"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h3 className="font-semibold text-sm truncate">
                {viewMode === "bot" ? "Vibro Assistant" : viewMode === "groups" ? "My Groups" : viewMode === "request" ? "Requested Group Chats" : selectedGroup?.name || "Chat"}
              </h3>
              {viewMode === "chat" && (
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
              )}
            </div>
            <button onClick={() => { disconnectSocket(); setOpen(false); setViewMode("bot"); }} className="hover:bg-blue-700 rounded p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Bot Home */}
          {viewMode === "bot" && (
            <ScrollArea className="flex-1 p-4">
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                  <MessageSquare className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">Hi! How can I help you?</p>
                <p className="text-sm text-gray-500">Choose an option below to get started.</p>
              </div>

              <button
                onClick={() => setViewMode("groups")}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors mb-3"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-gray-900">My Groups</p>
                  <p className="text-xs text-gray-500">View and chat in your existing groups</p>
                </div>
              </button>

              <button
                onClick={() => setViewMode("request")}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors mb-3"
              >
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-gray-900">Requested Group Chats</p>
                  <p className="text-xs text-gray-500">View your requests and their approval status</p>
                </div>
              </button>

              {isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors mb-3"
                >
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-sm text-gray-900">Create Group Chat</p>
                    <p className="text-xs text-gray-500">Directly create a new chat group (Admin only)</p>
                  </div>
                </button>
              )}

              {/* Admin: Pending Approvals */}
              {isAdmin && pendingRequests.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-gray-700 mb-2">Pending Approvals ({pendingRequests.length})</p>
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="p-3 rounded-lg border border-gray-100 mb-2">
                      <p className="font-semibold text-sm text-gray-900">{req.topic}</p>
                      {req.description && <p className="text-xs text-gray-500 mt-1">{req.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">By {req.requested_by?.username || "Unknown"}</p>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" className="h-7 text-xs" onClick={() => approveRequest(req.id)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => rejectRequest(req.id)}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}

          {/* Requested Group Chats View */}
          {viewMode === "request" && (
            <ScrollArea className="flex-1 p-3">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-bold text-gray-700">Your Group Requests</p>
                <Button size="sm" onClick={() => setShowRequestModal(true)}>
                  <Plus className="w-4 h-4 mr-1" /> New Request
                </Button>
              </div>
              {myRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Users className="w-12 h-12 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500 mb-3">No requests yet</p>
                  <Button size="sm" onClick={() => setShowRequestModal(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Request a Group Chat
                  </Button>
                </div>
              ) : (
                myRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-900">{req.topic}</p>
                      {req.description && <p className="text-xs text-gray-500 mt-1">{req.description}</p>}
                      <div className="flex items-center gap-1 mt-1">
                        {getStatusIcon(req.status)}
                        <span className="text-xs text-gray-500 capitalize">{req.status}</span>
                      </div>
                    </div>
                    {req.created_chat_group && req.status === "approved" && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => openChat(req.created_chat_group)}>
                        Open
                      </Button>
                    )}
                  </div>
                ))
              )}
            </ScrollArea>
          )}

          {/* Groups List */}
          {viewMode === "groups" && (
            <ScrollArea className="flex-1 p-3">
              {groupsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <MessageSquare className="w-12 h-12 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500 mb-3">No groups yet</p>
                  <Button size="sm" onClick={() => setShowRequestModal(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Request a Group
                  </Button>
                </div>
              ) : (
                groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => openChat(group)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors mb-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm text-gray-900 truncate">{group.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {group.last_message?.content || group.last_message?.attachment_name || "No messages yet"}
                      </p>
                    </div>
                    {group.unread_count > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {group.unread_count > 9 ? "9+" : group.unread_count}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </ScrollArea>
          )}

          {/* Chat Room */}
          {viewMode === "chat" && selectedGroup && (
            <>
              <ScrollArea className="flex-1 p-3">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSystem = msg.message_type === "system";
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }
                    const isMe = msg.sender?.id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2`}>
                        <div className={`max-w-[75%] rounded-xl px-3 py-2 ${isMe ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                          {!isMe && <p className="text-xs font-semibold text-gray-500 mb-1">{getSenderName(msg)}</p>}
                          {msg.content && <p className="text-sm">{renderContent(msg.content, isMe)}</p>}
                          {msg.attachment_url && msg.message_type === "image" && (
                            <a href={getFullUrl(msg.attachment_url) || "#"} target="_blank" rel="noopener noreferrer">
                              <img src={getFullUrl(msg.attachment_url) || ""} alt="attachment" className="rounded-lg mt-2 max-w-[200px] cursor-pointer hover:opacity-80" />
                            </a>
                          )}
                          {msg.attachment_url && msg.message_type === "video" && (
                            <a href={getFullUrl(msg.attachment_url) || "#"} target="_blank" rel="noopener noreferrer" className={`text-xs underline mt-1 block ${isMe ? "text-white" : "text-blue-600"}`}>
                              🎥 {msg.attachment_name || "Video"}
                            </a>
                          )}
                          {msg.attachment_url && msg.message_type === "file" && (
                            <a href={getFullUrl(msg.attachment_url) || "#"} target="_blank" rel="noopener noreferrer" className={`text-xs underline mt-1 block ${isMe ? "text-white" : "text-blue-600"}`}>
                              📎 {msg.attachment_name || "Attachment"}
                            </a>
                          )}
                          {msg.attachment_url && msg.message_type === "voice" && (
                            <a href={getFullUrl(msg.attachment_url) || "#"} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 mt-1 ${isMe ? "text-white" : "text-blue-600"}`}>
                              <Mic className="w-4 h-4" />
                              <span className="text-xs">Voice{msg.duration ? ` (${Math.round(msg.duration)}s)` : ""}</span>
                            </a>
                          )}
                          <p className={`text-[10px] mt-1 ${isMe ? "text-blue-200" : "text-gray-400"}`}>{formatTime(msg.created_at)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Input Bar */}
              <div className="relative flex items-center gap-1 p-2 border-t border-gray-200">
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, "image")} />
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, "video")} />
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, "file")} />
                <button onClick={() => imageInputRef.current?.click()} className="p-1.5 hover:bg-gray-100 rounded">
                  <ImageIcon className="w-5 h-5 text-gray-500" />
                </button>
                <button onClick={() => videoInputRef.current?.click()} className="p-1.5 hover:bg-gray-100 rounded">
                  <VideoIcon className="w-5 h-5 text-gray-500" />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-gray-100 rounded">
                  <Paperclip className="w-5 h-5 text-gray-500" />
                </button>
                <Input
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === "Enter" && handleSendText()}
                  placeholder="Type a message..."
                  className="flex-1 h-9"
                />
                {mentionList.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                    {mentionList.map((m: any) => {
                      const fullName = `${m.first_name} ${m.last_name}`.trim() || m.username;
                      return (
                        <button
                          key={m.id}
                          onClick={() => insertMention(fullName)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100 last:border-0"
                        >
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                            {fullName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-gray-700">{fullName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <button onClick={handleSendText} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Request Group Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Group Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="topic">Topic *</Label>
              <Input id="topic" value={requestTopic} onChange={(e) => setRequestTopic(e.target.value)} placeholder="e.g., Panel Repair Discussion" />
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={requestDesc} onChange={(e) => setRequestDesc(e.target.value)} placeholder="Brief description of what you want to discuss" rows={3} />
            </div>
            <div>
              <Label>Select Members *</Label>
              <p className="text-xs text-gray-500 mb-2">Choose colleagues and/or groups to include</p>
              {orgGroups.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Groups</p>
                  <MultiSelectCombobox
                    options={orgGroups.map((g) => ({ label: g.name, value: String(g.id) }))}
                    selectedValues={selectedGroups.map(String)}
                    onChange={(values) => setSelectedGroups(values.map(Number))}
                    placeholder="Select groups..."
                    searchPlaceholder="Search groups..."
                    notFoundText="No groups found."
                  />
                </div>
              )}
              <p className="text-xs font-semibold text-gray-600 mb-1">Users</p>
              <MultiSelectCombobox
                options={orgUsers.map((u) => ({ label: (u.first_name + " " + u.last_name).trim() || u.username, value: String(u.id) }))}
                selectedValues={selectedMembers.map(String)}
                onChange={(values) => setSelectedMembers(values.map(Number))}
                placeholder="Select users..."
                searchPlaceholder="Search users..."
                notFoundText="No users found."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestModal(false)}>Cancel</Button>
            <Button onClick={submitGroupRequest} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Group Modal (Admin only) */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Group Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="create-name">Group Name *</Label>
              <Input id="create-name" value={requestTopic} onChange={(e) => setRequestTopic(e.target.value)} placeholder="e.g., Maintenance Team" />
            </div>
            <div>
              <Label htmlFor="create-desc">Description</Label>
              <Textarea id="create-desc" value={requestDesc} onChange={(e) => setRequestDesc(e.target.value)} placeholder="Brief description" rows={3} />
            </div>
            <div>
              <Label>Select Members *</Label>
              <p className="text-xs text-gray-500 mb-2">Choose colleagues and/or groups to include</p>
              {orgGroups.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Groups</p>
                  <MultiSelectCombobox
                    options={orgGroups.map((g) => ({ label: g.name, value: String(g.id) }))}
                    selectedValues={selectedGroups.map(String)}
                    onChange={(values) => setSelectedGroups(values.map(Number))}
                    placeholder="Select groups..."
                    searchPlaceholder="Search groups..."
                    notFoundText="No groups found."
                  />
                </div>
              )}
              <p className="text-xs font-semibold text-gray-600 mb-1">Users</p>
              <MultiSelectCombobox
                options={orgUsers.map((u) => ({ label: (u.first_name + " " + u.last_name).trim() || u.username, value: String(u.id) }))}
                selectedValues={selectedMembers.map(String)}
                onChange={(values) => setSelectedMembers(values.map(Number))}
                placeholder="Select users..."
                searchPlaceholder="Search users..."
                notFoundText="No users found."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={createChatGroup} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
