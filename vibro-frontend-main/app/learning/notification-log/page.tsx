"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bell, Calendar, CheckCircle, XCircle, BookOpen, Award,
  Users, MapPin, User, Clock, Mail, Filter, RefreshCw,
  ChevronRight, AlertCircle, Trophy, Video, ThumbsUp, ThumbsDown,
  FileCheck
} from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";

const NOTIF_TYPE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  "training-created": { label: "Training Created", icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
  "training-modified": { label: "Training Modified", icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
  "training-cancelled": { label: "Training Cancelled", icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  "training-reminder": { label: "Training Reminder", icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
  "training-completed": { label: "Training Completed", icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
  "venue-changed": { label: "Venue Changed", icon: MapPin, color: "text-rose-600", bg: "bg-rose-50" },
  "trainer-changed": { label: "Trainer Changed", icon: User, color: "text-indigo-600", bg: "bg-indigo-50" },
  "enrollment-approved": { label: "Enrollment Approved", icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
  "enrollment-rejected": { label: "Enrollment Rejected", icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  "enrollment-request": { label: "Enrollment Request", icon: Users, color: "text-amber-600", bg: "bg-amber-50" },
  "quiz-assigned": { label: "Quiz Assigned", icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50" },
  "quiz-completed": { label: "Quiz Completed", icon: Trophy, color: "text-green-600", bg: "bg-green-50" },
  "quiz-failed": { label: "Quiz Failed", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  "certificate-issued": { label: "Certificate Issued", icon: Award, color: "text-yellow-600", bg: "bg-yellow-50" },
  "video-assigned": { label: "Video Assigned", icon: Video, color: "text-indigo-600", bg: "bg-indigo-50" },
  "video-completed": { label: "Video Completed", icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
  "approval-request": { label: "Approval Request", icon: FileCheck, color: "text-amber-600", bg: "bg-amber-50" },
  "approval-approved": { label: "Approval Approved", icon: ThumbsUp, color: "text-green-600", bg: "bg-green-50" },
  "approval-rejected": { label: "Approval Rejected", icon: ThumbsDown, color: "text-red-600", bg: "bg-red-50" },
};

interface NotificationLogItem {
  id: number;
  notif_type: string;
  title: string;
  message: string | null;
  content_type: string | null;
  content_id: string | null;
  content_title: string | null;
  is_read: boolean;
  created_at: string;
  user_name: string;
  user_username: string;
  user_email: string;
}

export default function NotificationLogPage() {
  const [notifications, setNotifications] = useState<NotificationLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, unread: 0 });
  const [filterType, setFilterType] = useState<string>("");
  const [filterRead, setFilterRead] = useState<string>("");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterType) params.notif_type = filterType;
      if (filterRead) params.is_read = filterRead;
      const res = await axiosInstance.get("/learning/my-notifications/admin-all/", { params });
      setNotifications(res.data.notifications || []);
      setStats({ total: res.data.total || 0, unread: res.data.unread || 0 });
    } catch (err) {
      console.error("Failed to fetch notification logs", err);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterRead]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <LearningLayout title="Notification Log" description="View all sent L&T notifications across your organization">
      <div className="space-y-4">
        {/* Stats */}
        <div className="flex gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-3">
            <div className="flex-shrink-0 bg-blue-50 rounded-lg p-2">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Sent</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-3">
            <div className="flex-shrink-0 bg-red-50 rounded-lg p-2">
              <Mail className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Unread</p>
              <p className="text-xl font-bold text-gray-900">{stats.unread}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-3">
            <div className="flex-shrink-0 bg-green-50 rounded-lg p-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Read</p>
              <p className="text-xl font-bold text-gray-900">{stats.total - stats.unread}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Filter className="w-4 h-4" /> Filters:
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {Object.entries(NOTIF_TYPE_META).map(([value, meta]) => (
              <option key={value} value={value}>{meta.label}</option>
            ))}
          </select>
          <select
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="false">Unread</option>
            <option value="true">Read</option>
          </select>
          <button
            onClick={fetchNotifications}
            className="ml-auto flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Notification Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No notifications found</p>
              <p className="text-gray-400 text-sm mt-1">Notifications will appear here when L&T events trigger them.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Recipient</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Content</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Message</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((item) => {
                    const meta = NOTIF_TYPE_META[item.notif_type] || { label: item.notif_type, icon: Bell, color: "text-gray-600", bg: "bg-gray-50" };
                    const Icon = meta.icon;
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`flex-shrink-0 ${meta.bg} rounded-lg p-1.5`}>
                              <Icon className={`w-4 h-4 ${meta.color}`} />
                            </div>
                            <span className="text-xs font-medium text-gray-700">{meta.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{item.user_name || "—"}</span>
                            <span className="text-xs text-gray-400">{item.user_email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{item.title}</span>
                        </td>
                        <td className="px-4 py-3">
                          {item.content_title ? (
                            <span className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-1">{item.content_title}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-xs text-gray-500 line-clamp-2">{item.message || "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          {item.is_read ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">
                              <CheckCircle className="w-3 h-3" /> Read
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
                              <Clock className="w-3 h-3" /> Unread
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400">{formatDate(item.created_at)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </LearningLayout>
  );
}
