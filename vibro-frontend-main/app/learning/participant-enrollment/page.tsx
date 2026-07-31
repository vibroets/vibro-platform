"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  UserPlus, CheckCircle, XCircle, Clock, Users, FileText, Video, BookOpen,
  Save, X, LayoutGrid, List, Search, Trash2, Bell, ChevronDown, ChevronRight,
  GraduationCap, AlertCircle, Check, UserCheck,
} from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  enrolled: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-teal-100 text-teal-700 border-teal-200",
};

const contentTypeConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  quiz: { icon: FileText, color: "text-blue-600", bg: "bg-blue-50", label: "Quiz Library" },
  video: { icon: Video, color: "text-green-600", bg: "bg-green-50", label: "Video Library" },
  training: { icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50", label: "Training Library" },
  "training-schedule": { icon: GraduationCap, color: "text-purple-600", bg: "bg-purple-50", label: "Training Calendar" },
};

export default function ParticipantEnrollmentPage() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [approvedTrainings, setApprovedTrainings] = useState<any[]>([]);
  const [participantMode, setParticipantMode] = useState<"users" | "groups" | "locations">("users");
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<"by-content" | "by-participant">("by-content");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [form, setForm] = useState({
    enrollment_title: "",
    content_type: "quiz",
    content_id: "",
    content_title: "",
    participant_ids: [] as number[],
    enrollment_type: "self",
    nominator: "",
    justification: "",
    auto_approve: true,
    notification_lead_value: 0,
    notification_lead_unit: "days",
  });

  useEffect(() => { fetchAll(); }, []);

  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [en, us, q, v, t, ts, gr, loc] = await Promise.all([
        axiosInstance.get("/learning/enrollments/", { params: { _t: Date.now() } }),
        axiosInstance.get("/learning/courses/users-list/"),
        axiosInstance.get("/learning/quizzes/"),
        axiosInstance.get("/learning/videos/"),
        axiosInstance.get("/learning/training-items/"),
        axiosInstance.get("/learning/training-schedules/"),
        axiosInstance.get("/learning/courses/groups-list/"),
        axiosInstance.get("/learning/courses/locations-list/"),
      ]);
      setEnrollments(en.data);
      setUsers(us.data);
      setGroups(gr.data);
      setLocations(loc.data);
      // Approved trainings that are not yet enrolled (awaiting enrollment)
      const enrolledTrainingIds = new Set(
        en.data
          .filter((e: any) => e.content_type === "training-schedule")
          .map((e: any) => parseInt(e.content_id))
      );
      const approved = ts.data.filter((t: any) => t.status === "approved" && !enrolledTrainingIds.has(t.id));
      setApprovedTrainings(approved);
      const allContent = [
        ...q.data.map((i: any) => ({ ...i, contentType: "quiz" })),
        ...v.data.map((i: any) => ({ ...i, contentType: "video" })),
        ...t.data.map((i: any) => ({ ...i, contentType: "training" })),
        ...ts.data.map((i: any) => ({ ...i, contentType: "training-schedule" })),
      ];
      setContent(allContent);
    } catch (e) {
      showNotification("error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (id: number) => {
    setForm(prev => ({
      ...prev,
      participant_ids: prev.participant_ids.includes(id)
        ? prev.participant_ids.filter(p => p !== id)
        : [...prev.participant_ids, id],
    }));
  };

  const toggleExpand = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const enrollApprovedTraining = (training: any) => {
    setForm({
      enrollment_title: training.title,
      content_type: "training-schedule",
      content_id: `training-schedule-${training.id}`,
      content_title: training.title,
      participant_ids: [],
      enrollment_type: "self",
      nominator: "",
      justification: "",
      auto_approve: true,
      notification_lead_value: 0,
      notification_lead_unit: "days",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content_id) { showNotification("error", "Please select content"); return; }
    if (form.participant_ids.length === 0) { showNotification("error", "Please select at least one participant"); return; }

    const selected = content.find(c => `${c.contentType}-${c.id}` === form.content_id);
    const actualContentId = selected ? String(selected.id) : form.content_id;
    setSubmitting(true);
    try {
      const res = await axiosInstance.post("/learning/enrollments/", {
        enrollment_title: form.enrollment_title,
        content_type: form.content_type,
        content_id: actualContentId,
        content_title: selected?.title || "",
        participant_ids: form.participant_ids,
        participant_mode: participantMode,
        enrollment_type: form.enrollment_type,
        nominator: form.nominator,
        justification: form.justification,
        auto_approve: form.auto_approve,
        notification_lead_value: form.notification_lead_value,
        notification_lead_unit: form.notification_lead_unit,
      });
      const data = res.data;
      if (data.created_count === 0 && data.duplicates && data.duplicates.length > 0) {
        showNotification("error", `No new enrollments created. Already enrolled: ${data.duplicates.join(", ")}`);
      } else if (data.duplicates && data.duplicates.length > 0) {
        showNotification("info", data.message || `${data.created_count} enrolled. Duplicates skipped: ${data.duplicates.join(", ")}`);
      } else {
        showNotification("success", `${data.created_count || form.participant_ids.length} participant(s) enrolled & content auto-assigned!`);
      }
      setShowModal(false);
      setForm({ enrollment_title: "", content_type: "quiz", content_id: "", content_title: "", participant_ids: [], enrollment_type: "self", nominator: "", justification: "", auto_approve: true, notification_lead_value: 0, notification_lead_unit: "days" });
      fetchAll();
    } catch (err: any) {
      console.error("Enrollment creation error:", err);
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || JSON.stringify(err?.response?.data || {});
      showNotification("error", "Failed: " + errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    try { await axiosInstance.patch(`/learning/enrollments/${id}/approve/`); showNotification("success", "Enrollment approved & content auto-assigned"); fetchAll(); } catch (e) { showNotification("error", "Failed to approve"); }
  };
  const handleReject = async (id: number) => {
    try { await axiosInstance.patch(`/learning/enrollments/${id}/reject/`); showNotification("success", "Enrollment rejected"); fetchAll(); } catch (e) { showNotification("error", "Failed to reject"); }
  };
  const handleDelete = async (id: number) => {
    if (!confirm("Delete this enrollment?")) return;
    try { await axiosInstance.delete(`/learning/enrollments/${id}/delete_enrollment/`); showNotification("success", "Enrollment deleted"); fetchAll(); } catch (e) { showNotification("error", "Failed to delete"); }
  };

  const stats = useMemo(() => ({
    total: enrollments.length,
    pending: enrollments.filter(e => e.status === "pending").length,
    approved: enrollments.filter(e => e.status === "approved").length,
    rejected: enrollments.filter(e => e.status === "rejected").length,
  }), [enrollments]);

  const filteredEnrollments = useMemo(() => {
    return enrollments.filter(en => {
      if (statusFilter !== "all" && en.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (en.participant_name || "").toLowerCase();
        const title = (en.content_title || "").toLowerCase();
        const enTitle = (en.enrollment_title || "").toLowerCase();
        if (!name.includes(q) && !title.includes(q) && !enTitle.includes(q)) return false;
      }
      return true;
    });
  }, [enrollments, statusFilter, searchQuery]);

  const enrollmentsByContent = useMemo(() => {
    const map: Record<string, any> = {};
    filteredEnrollments.forEach(en => {
      const key = en.enrollment_title ? `title-${en.enrollment_title}` : `${en.content_type}-${en.content_id}`;
      if (!map[key]) {
        const cInfo = content.find(c => `${c.contentType}-${c.id}` === `${en.content_type}-${en.content_id}`);
        map[key] = { ...cInfo, key, content_type: en.content_type, content_id: en.content_id, content_title: en.content_title || cInfo?.title || "Unknown", enrollment_title: en.enrollment_title || "", enrolledUsers: [] };
      }
      map[key].enrolledUsers.push(en);
    });
    return Object.values(map).sort((a: any, b: any) => b.enrolledUsers.length - a.enrolledUsers.length);
  }, [filteredEnrollments, content]);

  const enrollmentsByParticipant = useMemo(() => {
    const map: Record<number, any> = {};
    filteredEnrollments.forEach(en => {
      const uid = en.participant;
      if (!map[uid]) {
        const uInfo = users.find(u => u.id === uid);
        map[uid] = { ...uInfo, id: uid, name: en.participant_name || (uInfo ? `${uInfo.first_name} ${uInfo.last_name}`.trim() : `User ${uid}`), email: en.participant_email || uInfo?.email || "", enrolledContent: [] };
      }
      map[uid].enrolledContent.push(en);
    });
    return Object.values(map).sort((a: any, b: any) => b.enrolledContent.length - a.enrolledContent.length);
  }, [filteredEnrollments, users]);

  const statCards = [
    { label: "Total Enrollments", value: stats.total, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Approved", value: stats.approved, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  const renderStatusBadge = (status: string) => (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>{status}</span>
  );

  const renderApproveReject = (en: any) => (
    <div className="flex gap-1">
      {en.status === "pending" && (
        <>
          <button onClick={() => handleApprove(en.id)} className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors" title="Approve">
            <CheckCircle className="h-4 w-4" />
          </button>
          <button onClick={() => handleReject(en.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Reject">
            <XCircle className="h-4 w-4" />
          </button>
        </>
      )}
      <button onClick={() => handleDelete(en.id)} className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-lg transition-colors" title="Delete">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  const renderContentIcon = (type: string) => {
    const cfg = contentTypeConfig[type] || contentTypeConfig["quiz"];
    const Icon = cfg.icon;
    return (
      <div className={`w-10 h-10 rounded-lg ${cfg.bg} flex items-center justify-center`}>
        <Icon className={`h-5 w-5 ${cfg.color}`} />
      </div>
    );
  };

  return (
    <LearningLayout title="Participant Enrollment" description="Enroll participants in training content and manage enrollment approvals">
      {notification && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${
          notification.type === "success" ? "bg-green-500 text-white" : notification.type === "error" ? "bg-red-500 text-white" : "bg-blue-500 text-white"
        }`}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4" /> : notification.type === "error" ? <AlertCircle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {notification.message}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex gap-2">
          <button onClick={() => setViewMode("by-content")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "by-content" ? "bg-[#3A72EC] text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
            <LayoutGrid className="h-4 w-4" /> By Content
          </button>
          <button onClick={() => setViewMode("by-participant")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "by-participant" ? "bg-[#3A72EC] text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
            <List className="h-4 w-4" /> By Participant
          </button>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search enrollments..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#3A72EC] outline-none"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#3A72EC] outline-none bg-white">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="enrolled">Enrolled</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#3A72EC] text-white rounded-lg hover:bg-[#2a5dbf] transition-colors text-sm font-medium whitespace-nowrap">
            <UserPlus className="h-4 w-4" /> New Enrollment
          </button>
        </div>
      </div>

      {/* Approved Trainings Awaiting Enrollment */}
      {approvedTrainings.length > 0 && (
        <div className="mb-5 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-bold text-gray-800">Approved Trainings Awaiting Enrollment</h3>
            <span className="px-2 py-0.5 bg-purple-600 text-white rounded-full text-xs font-medium">{approvedTrainings.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {approvedTrainings.map((t: any) => (
              <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.start_date} → {t.end_date} • {t.venue_name || "TBD"} • {t.trainer_name || "TBD"}
                  </p>
                </div>
                <button
                  onClick={() => enrollApprovedTraining(t)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#3A72EC] text-white rounded-lg hover:bg-[#2a5dbf] transition-colors text-xs font-medium whitespace-nowrap ml-2"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Enroll
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3A72EC] mb-2"></div>
          <p>Loading enrollments...</p>
        </div>
      ) : viewMode === "by-content" ? (
        /* By Content View */
        <div className="grid gap-3">
          {enrollmentsByContent.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No enrollments found. Click "New Enrollment" to get started.</p>
            </div>
          ) : enrollmentsByContent.map((c: any) => {
            const key = c.key || `${c.content_type}-${c.content_id}`;
            const isExpanded = expandedItems.has(key) || enrollmentsByContent.length <= 5;
            const cfg = contentTypeConfig[c.content_type] || contentTypeConfig["quiz"];
            return (
              <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div
                  className="p-4 border-b border-gray-100 flex items-center gap-3 cursor-pointer hover:bg-gray-50/50"
                  onClick={() => toggleExpand(key)}
                >
                  {renderContentIcon(c.content_type)}
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{c.enrollment_title || c.content_title}</h3>
                    <p className="text-xs text-gray-500">
                      <span className="capitalize">{c.content_type}</span> • {c.content_title} • {c.enrolledUsers.length} enrolled
                    </p>
                  </div>
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                </div>
                {isExpanded && (
                  <div className="divide-y divide-gray-50">
                    {c.enrolledUsers.map((en: any) => (
                      <div key={en.id} className="flex items-center justify-between p-3 hover:bg-gray-50 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <Users className="h-4 w-4 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{en.participant_name || `User ${en.participant}`}</p>
                            <p className="text-xs text-gray-500 capitalize">
                              {en.enrollment_title ? `${en.enrollment_title} • ` : ""}{en.enrollment_type} enrollment
                              {en.justification ? ` • ${en.justification}` : ""}
                              {en.nominator ? ` • Nominated by ${en.nominator}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderStatusBadge(en.status)}
                          {renderApproveReject(en)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* By Participant View */
        <div className="grid gap-3">
          {enrollmentsByParticipant.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No participants with enrollments found.</p>
            </div>
          ) : enrollmentsByParticipant.map((u: any) => {
            const key = `user-${u.id}`;
            const isExpanded = expandedItems.has(key) || enrollmentsByParticipant.length <= 5;
            return (
              <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div
                  className="p-4 border-b border-gray-100 flex items-center gap-3 cursor-pointer hover:bg-gray-50/50"
                  onClick={() => toggleExpand(key)}
                >
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{u.name}</h3>
                    <p className="text-xs text-gray-500">{u.email} • {u.enrolledContent.length} enrollment(s)</p>
                  </div>
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                </div>
                {isExpanded && (
                  <div className="divide-y divide-gray-50">
                    {u.enrolledContent.map((en: any) => (
                      <div key={en.id} className="flex items-center justify-between p-3 hover:bg-gray-50 px-4">
                        <div className="flex items-center gap-3">
                          {renderContentIcon(en.content_type)}
                          <div>
                            <p className="text-sm font-medium text-gray-800">{en.enrollment_title || en.content_title || `Content ${en.content_id}`}</p>
                            <p className="text-xs text-gray-500 capitalize">
                              {en.content_type} • {en.enrollment_type}
                              {en.justification ? ` • ${en.justification}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderStatusBadge(en.status)}
                          {renderApproveReject(en)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Enrollment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-800">New Enrollment</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Enrollment Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Title *</label>
                <input
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A72EC] outline-none"
                  placeholder="e.g. Q3 Safety Training Enrollment"
                  value={form.enrollment_title}
                  onChange={e => setForm({ ...form, enrollment_title: e.target.value })}
                  required
                />
              </div>
              {/* Content Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Content *</label>
                <select
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A72EC] outline-none"
                  value={form.content_id}
                  onChange={e => {
                    const val = e.target.value;
                    const selected = content.find(c => `${c.contentType}-${c.id}` === val);
                    setForm({ ...form, content_id: val, content_type: selected?.contentType || "quiz" });
                  }}
                  required
                >
                  <option value="">Select Content...</option>
                  <optgroup label="Quiz Library">
                    {content.filter(c => c.contentType === "quiz").map(c => <option key={`quiz-${c.id}`} value={`quiz-${c.id}`}>{c.title}</option>)}
                  </optgroup>
                  <optgroup label="Video Library">
                    {content.filter(c => c.contentType === "video").map(c => <option key={`video-${c.id}`} value={`video-${c.id}`}>{c.title}</option>)}
                  </optgroup>
                  <optgroup label="Training Library">
                    {content.filter(c => c.contentType === "training").map(c => <option key={`training-${c.id}`} value={`training-${c.id}`}>{c.title}</option>)}
                  </optgroup>
                  <optgroup label="Training Calendar">
                    {content.filter(c => c.contentType === "training-schedule").map(c => <option key={`training-schedule-${c.id}`} value={`training-schedule-${c.id}`}>{c.title}</option>)}
                  </optgroup>
                </select>
              </div>

              {/* Enrollment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Type</label>
                <select
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A72EC] outline-none"
                  value={form.enrollment_type}
                  onChange={e => setForm({ ...form, enrollment_type: e.target.value })}
                >
                  <option value="self">Self Enrollment</option>
                  <option value="manager">Manager Nomination</option>
                  <option value="bulk">Bulk Enrollment</option>
                  <option value="department">Department Wide</option>
                </select>
              </div>

              {/* Participant Selection Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Participants * ({form.participant_ids.length} selected)
                </label>
                <div className="flex gap-1 mb-2 bg-gray-50 rounded-lg p-1">
                  <button type="button" onClick={() => { setParticipantMode("users"); setForm({ ...form, participant_ids: [] }); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium ${participantMode === "users" ? "bg-white shadow-sm text-[#3A72EC]" : "text-gray-500"}`}>Users</button>
                  <button type="button" onClick={() => { setParticipantMode("groups"); setForm({ ...form, participant_ids: [] }); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium ${participantMode === "groups" ? "bg-white shadow-sm text-[#3A72EC]" : "text-gray-500"}`}>Groups</button>
                  <button type="button" onClick={() => { setParticipantMode("locations"); setForm({ ...form, participant_ids: [] }); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium ${participantMode === "locations" ? "bg-white shadow-sm text-[#3A72EC]" : "text-gray-500"}`}>Locations</button>
                </div>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {participantMode === "users" && (
                    users.length === 0 ? <p className="p-3 text-sm text-gray-400">No users available</p> : users.map(u => (
                      <label key={u.id} className={`flex items-center gap-2 p-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 ${form.participant_ids.includes(u.id) ? "bg-blue-50/50" : ""}`}>
                        <input type="checkbox" checked={form.participant_ids.includes(u.id)} onChange={() => toggleParticipant(u.id)} className="rounded border-gray-300 text-[#3A72EC] focus:ring-[#3A72EC]" />
                        <div className="flex-1"><p className="text-sm font-medium text-gray-800">{u.first_name} {u.last_name}</p><p className="text-xs text-gray-500">{u.email}</p></div>
                      </label>
                    ))
                  )}
                  {participantMode === "groups" && (
                    groups.length === 0 ? <p className="p-3 text-sm text-gray-400">No groups available</p> : groups.map(g => (
                      <label key={g.id} className={`flex items-center gap-2 p-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 ${form.participant_ids.includes(g.id) ? "bg-blue-50/50" : ""}`}>
                        <input type="checkbox" checked={form.participant_ids.includes(g.id)} onChange={() => toggleParticipant(g.id)} className="rounded border-gray-300 text-[#3A72EC] focus:ring-[#3A72EC]" />
                        <div className="flex-1"><p className="text-sm font-medium text-gray-800">{g.name}</p><p className="text-xs text-gray-500">Group</p></div>
                      </label>
                    ))
                  )}
                  {participantMode === "locations" && (
                    locations.length === 0 ? <p className="p-3 text-sm text-gray-400">No locations available</p> : locations.map(l => (
                      <label key={l.id} className={`flex items-center gap-2 p-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 ${form.participant_ids.includes(l.id) ? "bg-blue-50/50" : ""}`}>
                        <input type="checkbox" checked={form.participant_ids.includes(l.id)} onChange={() => toggleParticipant(l.id)} className="rounded border-gray-300 text-[#3A72EC] focus:ring-[#3A72EC]" />
                        <div className="flex-1"><p className="text-sm font-medium text-gray-800">{l.name}</p><p className="text-xs text-gray-500">Location</p></div>
                      </label>
                    ))
                  )}
                </div>
                {participantMode === "users" && (
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => setForm({ ...form, participant_ids: users.map(u => u.id) })} className="text-xs text-[#3A72EC] hover:underline">Select All</button>
                    <button type="button" onClick={() => setForm({ ...form, participant_ids: [] })} className="text-xs text-gray-500 hover:underline">Clear</button>
                  </div>
                )}
              </div>

              {/* Nominator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nominator (optional)</label>
                <input
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A72EC] outline-none"
                  placeholder="Who is nominating?"
                  value={form.nominator}
                  onChange={e => setForm({ ...form, nominator: e.target.value })}
                />
              </div>

              {/* Justification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Justification (optional)</label>
                <textarea
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A72EC] outline-none"
                  rows={2}
                  placeholder="Why is this enrollment needed?"
                  value={form.justification}
                  onChange={e => setForm({ ...form, justification: e.target.value })}
                />
              </div>

              {/* Auto-approve */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.auto_approve}
                  onChange={e => setForm({ ...form, auto_approve: e.target.checked })}
                  className="rounded border-gray-300 text-[#3A72EC] focus:ring-[#3A72EC]"
                />
                <span className="text-sm text-gray-700">Auto-approve enrollment (content will be assigned immediately)</span>
              </label>

              {/* Notification Timing */}
              {form.content_type === "training-schedule" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-600" />
                    <label className="text-sm font-semibold text-blue-900">Notification Timing</label>
                  </div>
                  <p className="text-xs text-blue-700">When should participants be notified before the training starts?</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Notify before</label>
                      <input
                        type="number"
                        min="0"
                        value={form.notification_lead_value}
                        onChange={e => setForm({ ...form, notification_lead_value: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A72EC] outline-none"
                        placeholder="e.g. 7"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                      <select
                        value={form.notification_lead_unit}
                        onChange={e => setForm({ ...form, notification_lead_unit: e.target.value })}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A72EC] outline-none"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                      </select>
                    </div>
                  </div>
                  {form.notification_lead_value > 0 && (
                    <p className="text-xs text-blue-600">
                      Participants will be notified {form.notification_lead_value} {form.notification_lead_unit} before training starts.
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 bg-[#3A72EC] text-white rounded-lg hover:bg-[#2a5dbf] transition-colors disabled:opacity-50">
                  {submitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 white"></div> : <UserPlus className="h-4 w-4" />}
                  Enroll Participants
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </LearningLayout>
  );
}
