"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, Users, Plus, Edit, Trash2, FileText, Target, AlertTriangle, Save, X, CheckCircle, XCircle, UserPlus, ClipboardList, Send, Bell } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";
import { useModuleAccess } from "@/hooks/useModuleAccess";

interface TrainingFormState {
  title: string; code: string; category: string; training_type: string; description: string;
  objectives: string; learning_outcomes: string; duration: string; sessions: number;
  start_date: string; end_date: string; start_time: string; end_time: string;
  time_zone: string; grace_time: number; recurring: boolean; repeat_pattern: string;
  trainer_id: string; trainer_name: string; trainer_type: string;
  venue_id: string; venue_name: string; venue_type: string; capacity: number;
  department: string; location: string; lt_content_ids: { id: number; type: string }[];
  approval_type: string; approval_chain: { level: string; approver_id: string; approver_name: string }[];
}

const defaultForm: TrainingFormState = {
  title: "", code: "", category: "", training_type: "classroom", description: "",
  objectives: "", learning_outcomes: "", duration: "", sessions: 1,
  start_date: "", end_date: "", start_time: "09:00", end_time: "17:00",
  time_zone: "UTC", grace_time: 15, recurring: false, repeat_pattern: "none",
  trainer_id: "", trainer_name: "", trainer_type: "internal",
  venue_id: "", venue_name: "", venue_type: "training-room", capacity: 20,
  department: "", location: "", lt_content_ids: [] as { id: number; type: string }[],
  approval_type: "none", approval_chain: [] as { level: string; approver_id: string; approver_name: string }[],
};

export default function TrainingCalendarPage() {
  const { isFullAccess, isViewOnly, isSuperAdmin } = useModuleAccess("learning_training");
  const canEdit = isFullAccess || isSuperAdmin;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [trainings, setTrainings] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [ltContent, setLtContent] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<TrainingFormState>(defaultForm);
  const [conflictWarning, setConflictWarning] = useState("");
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [enrollForm, setEnrollForm] = useState({ participant_ids: [] as number[], participant_mode: "users" as "users" | "groups", enrollment_type: "self", justification: "", auto_approve: true, notification_lead_value: 0, notification_lead_unit: "days" });
  const [approvalForm, setApprovalForm] = useState({ approval_chain: [] as { level: string; approver_id: string; approver_name: string }[], justification: "" });
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentUsers, setDepartmentUsers] = useState<Record<string, any[]>>({});
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<number, number>>({});
  const [attendanceStats, setAttendanceStats] = useState<Record<number, any>>({});

  useEffect(() => { fetchTrainings(); fetchResources(); }, []);

  const fetchTrainings = async () => {
    try {
      const res = await axiosInstance.get("/learning/training-schedules/");
      setTrainings(res.data);
      fetchEnrollmentCounts(res.data);
      fetchAttendanceStats(res.data);
    } catch (e) {}
  };

  const fetchAttendanceStats = async (schedules: any[]) => {
    try {
      const stats: Record<number, any> = {};
      await Promise.all(schedules.map(async (s) => {
        try {
          const res = await axiosInstance.get(`/learning/training-schedules/${s.id}/attendance-stats/`);
          stats[s.id] = res.data;
        } catch (e) {}
      }));
      setAttendanceStats(stats);
    } catch (e) {}
  };

  const fetchEnrollmentCounts = async (schedules: any[]) => {
    try {
      const res = await axiosInstance.get("/learning/enrollments/");
      const counts: Record<number, number> = {};
      for (const en of res.data) {
        if (en.content_type === "training-schedule" && en.status === "approved") {
          const cid = parseInt(en.content_id);
          counts[cid] = (counts[cid] || 0) + 1;
        }
      }
      setEnrollmentCounts(counts);
    } catch (e) {}
  };

  const fetchResources = async () => {
    try {
      const [tr, vn, qz, vd, ti, us, gr, des] = await Promise.all([
        axiosInstance.get("/learning/trainers/"),
        axiosInstance.get("/learning/venues/"),
        axiosInstance.get("/learning/quizzes/"),
        axiosInstance.get("/learning/videos/"),
        axiosInstance.get("/learning/training-items/"),
        axiosInstance.get("/learning/courses/users-list/"),
        axiosInstance.get("/learning/courses/groups-list/"),
        axiosInstance.get("/learning/approvals/designations/"),
      ]);
      setTrainers(tr.data); setVenues(vn.data); setUsers(us.data); setGroups(gr.data); setDepartments(des.data);
      const allContent = [
        ...(Array.isArray(qz.data) ? qz.data : []).map((q: any) => ({ ...q, contentType: "quiz" })),
        ...(Array.isArray(vd.data) ? vd.data : []).map((v: any) => ({ ...v, contentType: "video" })),
        ...(Array.isArray(ti.data) ? ti.data : []).map((t: any) => ({ ...t, contentType: "training" })),
      ];
      setLtContent(allContent);
    } catch (e) {}
  };

  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const openCreate = () => { setEditing(null); setForm({ ...defaultForm, start_date: new Date().toISOString().split("T")[0], end_date: new Date().toISOString().split("T")[0] }); setConflictWarning(""); setShowModal(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ ...defaultForm, ...t }); setConflictWarning(""); setShowModal(true); };

  const handleTrainerChange = (trainerId: string) => {
    const selectedTrainer = trainers.find((t: any) => String(t.id) === trainerId);
    setForm(prev => ({ ...prev, trainer_id: trainerId, trainer_name: selectedTrainer?.name || "", trainer_type: selectedTrainer?.type || "internal" }));
  };

  const handleVenueChange = (venueId: string) => {
    const selectedVenue = venues.find((v: any) => String(v.id) === venueId);
    setForm(prev => ({ ...prev, venue_id: venueId, venue_name: selectedVenue?.name || "", venue_type: selectedVenue?.type || "training-room", capacity: selectedVenue?.capacity || 20, location: selectedVenue?.location || "" }));
  };

  const updateApprovalChainLevel = (idx: number, field: string, value: string) => {
    setForm(prev => {
      const chain = [...(prev.approval_chain || [])]; chain[idx] = { ...chain[idx], [field]: value };
      if (field === "level") { chain[idx].approver_id = ""; chain[idx].approver_name = ""; fetchUsersByDept(value); }
      if (field === "approver_id") { const ul = departmentUsers[chain[idx].level] || []; const u = ul.find(uu => String(uu.id) === String(value)); chain[idx].approver_name = u ? u.name : ""; }
      return { ...prev, approval_chain: chain };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) { await axiosInstance.patch(`/learning/training-schedules/${editing.id}/`, form); }
      else { await axiosInstance.post("/learning/training-schedules/", form); }
      setShowModal(false); fetchTrainings();
    } catch (e: any) { alert("Failed: " + (e.response?.data?.detail || "Error")); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this training?")) return;
    try { await axiosInstance.delete(`/learning/training-schedules/${id}/`); fetchTrainings(); } catch (e) { alert("Failed"); }
  };

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    setActionLoading(true);
    try {
      await axiosInstance.patch(`/learning/training-schedules/${id}/update-status/`, { status: newStatus });
      showNotification("success", `Training ${newStatus} successfully`);
      fetchTrainings();
    } catch (e: any) { showNotification("error", e.response?.data?.detail || "Failed"); } finally { setActionLoading(false); }
  };

  const handleGenerateAttendance = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await axiosInstance.post(`/learning/training-schedules/${id}/generate-attendance/`);
      showNotification("success", res.data.message);
      fetchTrainings();
    } catch (e: any) { showNotification("error", e.response?.data?.detail || "Failed to generate attendance"); } finally { setActionLoading(false); }
  };

  const openEnrollModal = (training: any) => {
    setSelectedTraining(training);
    setEnrollForm({ participant_ids: [], participant_mode: "users", enrollment_type: "self", justification: "", auto_approve: true, notification_lead_value: 0, notification_lead_unit: "days" });
    setShowEnrollModal(true);
  };

  const handleEnrollSubmit = async () => {
    if (enrollForm.participant_ids.length === 0) { showNotification("error", "Select at least one participant"); return; }
    setActionLoading(true);
    try {
      await axiosInstance.post("/learning/enrollments/", {
        content_type: "training-schedule",
        content_id: selectedTraining.id,
        content_title: selectedTraining.title,
        enrollment_title: selectedTraining.title,
        participant_ids: enrollForm.participant_ids,
        participant_mode: enrollForm.participant_mode,
        enrollment_type: enrollForm.enrollment_type,
        nominator: "",
        justification: enrollForm.justification,
        auto_approve: enrollForm.auto_approve,
        notification_lead_value: enrollForm.notification_lead_value,
        notification_lead_unit: enrollForm.notification_lead_unit,
      });
      showNotification("success", `Enrolled ${enrollForm.participant_ids.length} participant(s)`);
      setShowEnrollModal(false);
      fetchTrainings();
    } catch (e: any) { showNotification("error", e.response?.data?.detail || "Failed to enroll"); } finally { setActionLoading(false); }
  };

  const openApprovalModal = (training: any) => {
    setSelectedTraining(training);
    setApprovalForm({ approval_chain: [{ level: "HR", approver_id: "", approver_name: "" }], justification: "" });
    setShowApprovalModal(true);
  };

  const fetchUsersByDept = async (dept: string) => {
    if (departmentUsers[dept]) return;
    try { const res = await axiosInstance.get(`/learning/approvals/users-by-designation/?designation=${dept}`); setDepartmentUsers(prev => ({ ...prev, [dept]: res.data })); } catch (e) {}
  };

  const updateChainLevel = (idx: number, field: string, value: string) => {
    setApprovalForm(prev => {
      const chain = [...prev.approval_chain]; chain[idx] = { ...chain[idx], [field]: value };
      if (field === "level") { chain[idx].approver_id = ""; chain[idx].approver_name = ""; fetchUsersByDept(value); }
      if (field === "approver_id") { const ul = departmentUsers[chain[idx].level] || []; const u = ul.find(uu => String(uu.id) === String(value)); chain[idx].approver_name = u ? u.name : ""; }
      return { ...prev, approval_chain: chain };
    });
  };

  const handleApprovalSubmit = async () => {
    for (const c of approvalForm.approval_chain) { if (!c.approver_id) { showNotification("error", `Select approver for ${c.level}`); return; } }
    setActionLoading(true);
    try {
      await axiosInstance.post("/learning/approvals/", {
        title: `Training Approval: ${selectedTraining.title}`,
        type: "training-request",
        requested_by: "",
        department: selectedTraining.department || "",
        description: `Approval request for training "${selectedTraining.title}" scheduled on ${selectedTraining.start_date}`,
        approval_chain: approvalForm.approval_chain,
        training_id: String(selectedTraining.id),
        training_title: selectedTraining.title,
        expected_outcome: selectedTraining.learning_outcomes || "",
        justification: approvalForm.justification,
      });
      showNotification("success", "Approval request sent!");
      setShowApprovalModal(false);
    } catch (e: any) { showNotification("error", e.response?.data?.detail || "Failed to send approval"); } finally { setActionLoading(false); }
  };

  // Calendar helpers
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [...Array.from({ length: firstDay }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const getTrainingsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return trainings.filter(t => t.start_date === dateStr || (t.start_date <= dateStr && t.end_date >= dateStr));
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const statusColors: Record<string, string> = { pending: "bg-amber-100 text-amber-700", approved: "bg-green-100 text-green-700", completed: "bg-blue-100 text-blue-700", rejected: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-700" };

  return (
    <LearningLayout title="Training Calendar" description="View and manage training schedules">
      {notification && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${notification.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : notification.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4" /> : notification.type === "error" ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {notification.message}
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"><ChevronLeft className="h-5 w-5 text-gray-600" /></button>
          <h2 className="text-lg font-bold text-gray-900">{monthNames[month]} {year}</h2>
          <button onClick={nextMonth} className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"><ChevronRight className="h-5 w-5 text-gray-600" /></button>
        </div>
        {canEdit ? (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#3A72EC] text-white rounded-lg hover:bg-[#2a5dbf] transition-colors text-sm font-medium">
            <Plus className="h-4 w-4" /> Schedule Training
          </button>
        ) : isViewOnly ? (
          <span className="text-xs text-gray-500 italic">View only access</span>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => (
            <div key={idx} className={`min-h-[80px] border border-gray-100 rounded-lg p-1.5 ${day ? "bg-white" : "bg-gray-50"}`}>
              {day && (
                <>
                  <p className="text-xs font-medium text-gray-700 mb-1">{day}</p>
                  {getTrainingsForDay(day).slice(0, 2).map(t => (
                    <div key={t.id} className={`text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer ${statusColors[t.status] || "bg-gray-100 text-gray-700"}`} onClick={() => openEdit(t)}>{t.title}</div>
                  ))}
                  {getTrainingsForDay(day).length > 2 && <p className="text-[10px] text-gray-400">+{getTrainingsForDay(day).length - 2} more</p>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">All Trainings</h2>
          <span className="text-xs text-gray-500">{trainings.length} {trainings.length === 1 ? "training" : "trainings"}</span>
        </div>
        {trainings.length === 0 ? <p className="text-gray-400 text-sm px-6 py-8 text-center">No trainings scheduled.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-600 text-xs uppercase tracking-wide">Title</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-600 text-xs uppercase tracking-wide min-w-[180px]">Schedule</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-600 text-xs uppercase tracking-wide">Venue</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-600 text-xs uppercase tracking-wide">Trainer</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-600 text-xs uppercase tracking-wide">Participants</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-600 text-xs uppercase tracking-wide">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {trainings.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-gray-900 text-sm leading-tight">{t.title}</div>
                      {t.code && <div className="text-xs text-gray-400 mt-0.5">{t.code}</div>}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="text-gray-700 text-sm">{t.start_date}{t.end_date !== t.start_date && ` → ${t.end_date}`}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{t.start_time} – {t.end_time} {t.time_zone || ""}</div>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 text-sm">{t.venue_name || <span className="text-gray-300">—</span>}</td>
                    <td className="py-2.5 px-4 text-gray-600 text-sm">{t.trainer_name || <span className="text-gray-300">—</span>}</td>
                    <td className="py-2.5 px-4">
                      {attendanceStats[t.id] ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{attendanceStats[t.id].enrolled} total</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-600">{attendanceStats[t.id].checked_in} in</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">{attendanceStats[t.id].completed} done</span>
                        </div>
                      ) : enrollmentCounts[t.id] ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{enrollmentCounts[t.id]} enrolled</span>
                      ) : <span className="text-gray-300 text-sm">—</span>}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status] || "bg-gray-100 text-gray-700"}`}>{t.status}</span>
                      {t.approval_type && t.approval_type !== "none" && t.status === "pending" && (
                        <div className="text-[10px] text-amber-500 mt-0.5">{t.approval_type}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1">
                        {canEdit && t.status === "pending" && (!t.approval_type || t.approval_type === "none") && (
                          <button onClick={() => handleStatusUpdate(t.id, "approved")} disabled={actionLoading} className="p-1.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Approve"><CheckCircle className="h-4 w-4" /></button>
                        )}
                        {canEdit && t.status === "approved" && (
                          <>
                            {enrollmentCounts[t.id] > 0 ? (
                              <>
                                <a href="/learning/participant-enrollment" className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Add Participants"><UserPlus className="h-4 w-4" /></a>
                                <button onClick={() => handleGenerateAttendance(t.id)} disabled={actionLoading} className="p-1.5 rounded-md bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors" title="Generate Attendance"><ClipboardList className="h-4 w-4" /></button>
                              </>
                            ) : (
                              <a href="/learning/participant-enrollment" className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Enroll Participants"><UserPlus className="h-4 w-4" /></a>
                            )}
                            <button onClick={() => handleStatusUpdate(t.id, "completed")} disabled={actionLoading} className="p-1.5 rounded-md bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors" title="Mark Completed"><CheckCircle className="h-4 w-4" /></button>
                          </>
                        )}
                        {t.status === "completed" && (
                          <a href="/learning/attendance" className="p-1.5 rounded-md bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors" title="View Attendance"><ClipboardList className="h-4 w-4" /></a>
                        )}
                        {canEdit && (
                          <>
                            <button onClick={() => openEdit(t)} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="Edit"><Edit className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white rounded-t-lg">
              <h2 className="text-xl font-semibold text-gray-900">{editing ? "Edit" : "Create"} Training</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><FileText className="w-5 h-5" /> Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Training Title *</label><input type="text" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter training title" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Training Code</label><input type="text" value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., TRN-001" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label><input type="text" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter category" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Training Type</label><select value={form.training_type} onChange={e => setForm({...form, training_type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"><option value="classroom">Classroom</option><option value="online">Online</option><option value="hybrid">Hybrid</option><option value="on-the-job">On the Job</option></select></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter training description" /></div>
              </div>
              {/* Objectives & Outcomes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Target className="w-5 h-5" /> Objectives & Outcomes</h3>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Learning Objectives</label><textarea value={form.objectives} onChange={e => setForm({...form, objectives: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter learning objectives" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Learning Outcomes</label><textarea value={form.learning_outcomes} onChange={e => setForm({...form, learning_outcomes: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter expected learning outcomes" /></div>
              </div>
              {/* Schedule */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5" /> Schedule Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label><input type="text" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., 8" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Number of Sessions</label><input type="number" min="1" value={form.sessions} onChange={e => setForm({...form, sessions: parseInt(e.target.value) || 1})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label><input type="date" required value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label><input type="date" required value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label><input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label><input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Time Zone</label><select value={form.time_zone} onChange={e => setForm({...form, time_zone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"><option value="UTC">UTC</option><option value="IST">IST</option><option value="EST">EST</option><option value="PST">PST</option></select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Grace Time (minutes)</label><input type="number" min="0" value={form.grace_time} onChange={e => setForm({...form, grace_time: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /><p className="text-xs text-gray-500 mt-1">Time allowed for check-in after training starts</p></div>
                </div>
                <div className="flex items-center gap-2"><input type="checkbox" id="recurring" checked={form.recurring} onChange={e => setForm({...form, recurring: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" /><label htmlFor="recurring" className="text-sm font-medium text-gray-700">Recurring Training</label></div>
                {form.recurring && <div><label className="block text-sm font-medium text-gray-700 mb-1">Repeat Pattern</label><select value={form.repeat_pattern} onChange={e => setForm({...form, repeat_pattern: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"><option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom</option></select></div>}
              </div>
              {/* Resource Allocation */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5" /> Resource Allocation</h3>
                {conflictWarning && <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"><AlertTriangle className="w-5 h-5 text-yellow-600" /><span className="text-sm text-yellow-800">{conflictWarning}</span></div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Trainer</label><select value={form.trainer_id} onChange={e => handleTrainerChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"><option value="">Select a trainer</option>{trainers.map((tr: any) => <option key={tr.id} value={tr.id}>{tr.name} ({tr.type})</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Venue</label><select value={form.venue_id} onChange={e => handleVenueChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"><option value="">Select a venue</option>{venues.map((vn: any) => <option key={vn.id} value={vn.id}>{vn.name} (Capacity: {vn.capacity})</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label><input type="number" min="1" value={form.capacity} onChange={e => setForm({...form, capacity: parseInt(e.target.value) || 20})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Department</label><input type="text" value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter department" /></div>
                </div>
              </div>
              {/* L&T Content Integration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Send className="w-5 h-5" /> Approval Configuration</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Approval Required?</label>
                  <select value={form.approval_type} onChange={e => {
                    const val = e.target.value;
                    setForm(prev => ({ ...prev, approval_type: val, approval_chain: val === "none" ? [] : [{ level: "HR", approver_id: "", approver_name: "" }] }));
                  }} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="none">No Approval Needed (Direct)</option>
                    <option value="single-stage">Single-Stage Approval</option>
                    <option value="multi-stage">Multi-Stage Approval</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {form.approval_type === "none" && "Training will be created with pending status. You can directly approve it."}
                    {form.approval_type === "single-stage" && "One approver needs to approve before training is confirmed."}
                    {form.approval_type === "multi-stage" && "Multiple approvers in sequence. Each must approve before next level."}
                  </p>
                </div>
                {form.approval_type !== "none" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Approval Chain</label>
                    {(form.approval_chain || []).map((c, idx) => (
                      <div key={idx} className="flex gap-2 mb-2 items-center">
                        <select value={c.level} onChange={e => updateApprovalChainLevel(idx, "level", e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                          {departments.map(d => <option key={`${d.id}-${d.name}`} value={d.name}>{d.name}</option>)}
                        </select>
                        <select value={c.approver_id} onChange={e => updateApprovalChainLevel(idx, "approver_id", e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                          <option value="">Select approver</option>
                          {(departmentUsers[c.level] || []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        {form.approval_type === "multi-stage" && (form.approval_chain || []).length > 1 && (
                          <button type="button" onClick={() => setForm(prev => ({ ...prev, approval_chain: (prev.approval_chain || []).filter((_, i) => i !== idx) }))} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><X className="h-4 w-4" /></button>
                        )}
                      </div>
                    ))}
                    {form.approval_type === "multi-stage" && (
                      <button type="button" onClick={() => setForm(prev => ({ ...prev, approval_chain: [...(prev.approval_chain || []), { level: "HR", approver_id: "", approver_name: "" }] }))} className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 text-sm font-medium"><Plus className="h-3.5 w-3.5" /> Add Level</button>
                    )}
                  </div>
                )}
              </div>
              {/* L&T Content Integration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><FileText className="w-5 h-5" /> L&T Content Integration</h3>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Link L&T Content (Optional)</label><p className="text-xs text-gray-500 mb-2">Select quizzes, videos, or training items to automatically assign to participants</p><div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">{ltContent.length === 0 ? <p className="text-sm text-gray-500">No L&T content available.</p> : ltContent.map((content: any) => <label key={`${content.contentType}-${content.id}`} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={form.lt_content_ids?.some((c: any) => c.id === content.id && c.type === content.contentType)} onChange={e => { const newIds = e.target.checked ? [...(form.lt_content_ids || []), { id: content.id, type: content.contentType }] : form.lt_content_ids?.filter((c: any) => !(c.id === content.id && c.type === content.contentType)); setForm(prev => ({ ...prev, lt_content_ids: newIds })); }} className="rounded text-blue-600" /><span className="text-sm"><span className="font-medium">{content.title}</span><span className="text-gray-500 ml-2">({content.contentType})</span></span></label>)}</div></div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Save className="w-4 h-4" /> {editing ? "Update Training" : "Save Training"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enrollment Modal */}
      {showEnrollModal && selectedTraining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><UserPlus className="h-5 w-5" /> Enroll Participants — {selectedTraining.title}</h2>
              <button onClick={() => setShowEnrollModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setEnrollForm({ ...enrollForm, participant_mode: "users", participant_ids: [] })} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${enrollForm.participant_mode === "users" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>By Users</button>
                <button onClick={() => setEnrollForm({ ...enrollForm, participant_mode: "groups", participant_ids: [] })} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${enrollForm.participant_mode === "groups" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>By Groups</button>
              </div>
              <div className="border border-gray-300 rounded-lg p-3 max-h-60 overflow-y-auto">
                {enrollForm.participant_mode === "users" ? (
                  users.length === 0 ? <p className="text-sm text-gray-500">No users available.</p> :
                  users.map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" checked={enrollForm.participant_ids.includes(u.id)} onChange={e => { const newIds = e.target.checked ? [...enrollForm.participant_ids, u.id] : enrollForm.participant_ids.filter(id => id !== u.id); setEnrollForm({ ...enrollForm, participant_ids: newIds }); }} className="rounded text-blue-600" />
                      <span className="text-sm">{u.name || `${u.first_name} ${u.last_name}`.trim() || u.username} <span className="text-gray-400">({u.email})</span></span>
                    </label>
                  ))
                ) : (
                  groups.length === 0 ? <p className="text-sm text-gray-500">No groups available.</p> :
                  groups.map((g: any) => (
                    <label key={g.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" checked={enrollForm.participant_ids.includes(g.id)} onChange={e => { const newIds = e.target.checked ? [...enrollForm.participant_ids, g.id] : enrollForm.participant_ids.filter(id => id !== g.id); setEnrollForm({ ...enrollForm, participant_ids: newIds }); }} className="rounded text-blue-600" />
                      <span className="text-sm font-medium">{g.name}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Type</label><select value={enrollForm.enrollment_type} onChange={e => setEnrollForm({ ...enrollForm, enrollment_type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"><option value="self">Self</option><option value="manager">Manager</option><option value="bulk">Bulk</option><option value="department">Department</option></select></div>
                <div className="flex items-end"><label className="flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={enrollForm.auto_approve} onChange={e => setEnrollForm({ ...enrollForm, auto_approve: e.target.checked })} className="rounded text-blue-600" /> Auto-approve enrollments</label></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Justification (optional)</label><input type="text" value={enrollForm.justification} onChange={e => setEnrollForm({ ...enrollForm, justification: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Reason for enrollment" /></div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-blue-600" /><label className="text-sm font-semibold text-blue-900">Notification Timing</label></div>
                <p className="text-xs text-blue-700">When should participants be notified before training starts?</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1"><label className="block text-xs font-medium text-gray-600 mb-1">Notify before</label><input type="number" min="0" value={enrollForm.notification_lead_value} onChange={e => setEnrollForm({ ...enrollForm, notification_lead_value: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" placeholder="e.g. 7" /></div>
                  <div className="flex-1"><label className="block text-xs font-medium text-gray-600 mb-1">Unit</label><select value={enrollForm.notification_lead_unit} onChange={e => setEnrollForm({ ...enrollForm, notification_lead_unit: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option></select></div>
                </div>
                {enrollForm.notification_lead_value > 0 && <p className="text-xs text-blue-600">Participants will be notified {enrollForm.notification_lead_value} {enrollForm.notification_lead_unit} before training starts.</p>}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowEnrollModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
                <button onClick={handleEnrollSubmit} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><UserPlus className="h-4 w-4" /> {actionLoading ? "Enrolling..." : `Enroll ${enrollForm.participant_ids.length} Participant(s)`}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedTraining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Send className="h-5 w-5" /> Send for Approval — {selectedTraining.title}</h2>
              <button onClick={() => setShowApprovalModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p><strong>Training:</strong> {selectedTraining.title}</p>
                <p><strong>Date:</strong> {selectedTraining.start_date} → {selectedTraining.end_date}</p>
                <p><strong>Trainer:</strong> {selectedTraining.trainer_name || "TBD"}</p>
                <p><strong>Venue:</strong> {selectedTraining.venue_name || "TBD"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Approval Chain</label>
                <p className="text-xs text-gray-500 mb-2">Add approval levels (e.g., HR → Management). Approvers are selected by department.</p>
                {approvalForm.approval_chain.map((c, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 items-center">
                    <select value={c.level} onChange={e => updateChainLevel(idx, "level", e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {departments.map(d => <option key={`${d.id}-${d.name}`} value={d.name}>{d.name}</option>)}
                    </select>
                    <select value={c.approver_id} onChange={e => updateChainLevel(idx, "approver_id", e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="">Select approver</option>
                      {(departmentUsers[c.level] || []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    {approvalForm.approval_chain.length > 1 && <button onClick={() => setApprovalForm({ ...approvalForm, approval_chain: approvalForm.approval_chain.filter((_, i) => i !== idx) })} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><X className="h-4 w-4" /></button>}
                  </div>
                ))}
                <button onClick={() => setApprovalForm({ ...approvalForm, approval_chain: [...approvalForm.approval_chain, { level: "HR", approver_id: "", approver_name: "" }] })} className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 text-sm font-medium"><Plus className="h-3.5 w-3.5" /> Add Level</button>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Justification</label><textarea value={approvalForm.justification} onChange={e => setApprovalForm({ ...approvalForm, justification: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Why is this training needed?" /></div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowApprovalModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
                <button onClick={handleApprovalSubmit} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"><Send className="h-4 w-4" /> {actionLoading ? "Sending..." : "Send for Approval"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </LearningLayout>
  );
}
