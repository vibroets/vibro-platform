"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Video, FileText, Plus, Edit, Trash2, Share2, Users, Save, X, FileUp, MapPin, Building2, FileSpreadsheet, Eye } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";
import QuestionBuilder, { Question } from "@/components/learning/QuestionBuilder";

interface QuizForm {
  title: string; description: string; questionsPerUser: number; timeLimit: number;
  passPercentage: number; allowSkip: boolean; issueCertificate: boolean;
  validityPeriod: number; validityUnit: string; accessMode: string;
  reassignOnFail: boolean; rescheduleDays: number; questions: Question[]; selectedUsers: string[];
}

interface VideoForm {
  title: string; description: string; videoSource: string; videoUrl: string;
  videoFile: File | null; questionsPerUser: number; timeLimit: number;
  passPercentage: number; allowSkip: boolean; issueCertificate: boolean;
  validityPeriod: number; validityUnit: string; accessMode: string;
  reassignOnFail: boolean; rescheduleDays: number; questions: Question[]; selectedUsers: string[];
}

interface TrainingForm {
  title: string; description: string; assetType: string; sourceType: string;
  fileUrl: string; file: File | null; allowDownload: boolean; allowPrint: boolean;
  allowShare: boolean; followUpType: string; followUpId: string;
  questionsPerUser: number; timeLimit: number; passPercentage: number; allowSkip: boolean;
  issueCertificate: boolean; validityPeriod: number; validityUnit: string;
  accessMode: string; reassignOnFail: boolean; rescheduleDays: number;
  questions: Question[]; selectedUsers: string[];
}

const defaultQuizForm: QuizForm = {
  title: "", description: "", questionsPerUser: 15, timeLimit: 30, passPercentage: 70,
  allowSkip: false, issueCertificate: false, validityPeriod: 1, validityUnit: "years",
  accessMode: "permanent", reassignOnFail: false, rescheduleDays: 7, questions: [], selectedUsers: [],
};

const defaultVideoForm: VideoForm = {
  title: "", description: "", videoSource: "url", videoUrl: "", videoFile: null,
  questionsPerUser: 15, timeLimit: 30, passPercentage: 70, allowSkip: false,
  issueCertificate: false, validityPeriod: 1, validityUnit: "years",
  accessMode: "permanent", reassignOnFail: false, rescheduleDays: 7, questions: [], selectedUsers: [],
};

const defaultTrainingForm: TrainingForm = {
  title: "", description: "", assetType: "document", sourceType: "url", fileUrl: "", file: null,
  allowDownload: false, allowPrint: false, allowShare: false, followUpType: "", followUpId: "",
  questionsPerUser: 15, timeLimit: 30, passPercentage: 70, allowSkip: false,
  issueCertificate: false, validityPeriod: 1, validityUnit: "years",
  accessMode: "permanent", reassignOnFail: false, rescheduleDays: 7, questions: [], selectedUsers: [],
};

export default function LTModulePage() {
  const [activeTab, setActiveTab] = useState("quiz");
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [trainingItems, setTrainingItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [quizForm, setQuizForm] = useState<QuizForm>(defaultQuizForm);
  const [videoForm, setVideoForm] = useState<VideoForm>(defaultVideoForm);
  const [trainingForm, setTrainingForm] = useState<TrainingForm>(defaultTrainingForm);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareItem, setShareItem] = useState<any>(null);
  const [shareUserIds, setShareUserIds] = useState<string[]>([]);
  const [shareGroupIds, setShareGroupIds] = useState<string[]>([]);
  const [shareLocationIds, setShareLocationIds] = useState<string[]>([]);
  const [shareTab, setShareTab] = useState<"users" | "groups" | "locations">("users");
  const [viewItem, setViewItem] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
  const [attemptedCounts, setAttemptedCounts] = useState<Record<number, number>>({});

  useEffect(() => { fetchAll(); fetchShareData(); }, []);

  const fetchAll = async () => {
    try {
      const [q, v, t] = await Promise.all([
        axiosInstance.get("/learning/quizzes/"),
        axiosInstance.get("/learning/videos/"),
        axiosInstance.get("/learning/training-items/"),
      ]);
      setQuizzes(Array.isArray(q.data) ? q.data : (q.data?.results || []));
      setVideos(Array.isArray(v.data) ? v.data : (v.data?.results || []));
      setTrainingItems(Array.isArray(t.data) ? t.data : (t.data?.results || []));
      const allItems = [
        ...(Array.isArray(q.data) ? q.data : (q.data?.results || [])),
        ...(Array.isArray(v.data) ? v.data : (v.data?.results || [])),
        ...(Array.isArray(t.data) ? t.data : (t.data?.results || [])),
      ];
      fetchAttemptedCounts(allItems);
    } catch (e) { console.error(e); }
  };

  const fetchAttemptedCounts = async (items: any[]) => {
    const counts: Record<number, number> = {};
    await Promise.all(items.map(async (item) => {
      try {
        const res = await axiosInstance.get(`/learning/courses/results-by-content/?content_id=${item.id}`);
        counts[item.id] = Array.isArray(res.data) ? res.data.length : 0;
      } catch { counts[item.id] = 0; }
    }));
    setAttemptedCounts(counts);
  };

  const fetchShareData = async () => {
    try {
      const [u, g, l] = await Promise.all([
        axiosInstance.get("/learning/courses/users-list/"),
        axiosInstance.get("/learning/courses/groups-list/"),
        axiosInstance.get("/learning/courses/locations-list/"),
      ]);
      setUsers(Array.isArray(u.data) ? u.data : []);
      setGroups(Array.isArray(g.data) ? g.data : []);
      setLocations(Array.isArray(l.data) ? l.data : []);
    } catch (e) { console.error(e); }
  };

  const currentItems = activeTab === "quiz" ? quizzes : activeTab === "video" ? videos : trainingItems;

  const openCreate = () => {
    setEditingItem(null);
    setQuizForm(defaultQuizForm); setVideoForm(defaultVideoForm); setTrainingForm(defaultTrainingForm);
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    if (activeTab === "quiz") {
      setQuizForm({
        ...defaultQuizForm,
        title: item.title || "",
        description: item.description || "",
        questionsPerUser: item.questions_per_user ?? 15,
        timeLimit: item.time_limit ?? 30,
        passPercentage: item.pass_percentage ?? 70,
        allowSkip: item.allow_skip_questions ?? false,
        issueCertificate: item.certificate_enabled ?? false,
        validityPeriod: item.certificate_validity_value ?? 1,
        validityUnit: item.certificate_validity_unit || "years",
        accessMode: item.access_mode || "permanent",
        reassignOnFail: item.reassign_on_fail ?? false,
        rescheduleDays: item.reschedule_days ?? 7,
        questions: item.questions || [],
        selectedUsers: item.selected_users || [],
      });
    } else if (activeTab === "video") {
      setVideoForm({
        ...defaultVideoForm,
        title: item.title || "",
        description: item.description || "",
        videoSource: item.video_source || "url",
        videoUrl: item.video_url || "",
        videoFile: null,
        questionsPerUser: item.questions_per_user ?? 15,
        timeLimit: item.time_limit ?? 30,
        passPercentage: item.pass_percentage ?? 70,
        allowSkip: item.allow_skip_questions ?? false,
        issueCertificate: item.certificate_enabled ?? false,
        validityPeriod: item.certificate_validity_value ?? 1,
        validityUnit: item.certificate_validity_unit || "years",
        accessMode: item.access_mode || "permanent",
        reassignOnFail: item.reassign_on_fail ?? false,
        rescheduleDays: item.reschedule_days ?? 7,
        questions: item.questions || [],
        selectedUsers: item.selected_users || [],
      });
    } else {
      setTrainingForm({
        ...defaultTrainingForm,
        title: item.title || "",
        description: item.description || "",
        assetType: item.asset_type || "document",
        sourceType: item.source_type || "url",
        fileUrl: item.file_url || item.content_url || "",
        file: null,
        allowDownload: item.allow_download ?? false,
        allowPrint: item.allow_print ?? false,
        allowShare: item.allow_share ?? false,
        followUpType: item.follow_up_type || "",
        followUpId: item.follow_up_id || "",
        questionsPerUser: item.questions_per_user ?? 15,
        timeLimit: item.time_limit ?? 30,
        passPercentage: item.pass_percentage ?? 70,
        allowSkip: item.allow_skip_questions ?? false,
        issueCertificate: item.certificate_enabled ?? false,
        validityPeriod: item.certificate_validity_value ?? 1,
        validityUnit: item.certificate_validity_unit || "years",
        accessMode: item.access_mode || "permanent",
        reassignOnFail: item.reassign_on_fail ?? false,
        rescheduleDays: item.reschedule_days ?? 7,
        questions: item.questions || [],
        selectedUsers: item.selected_users || [],
      });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = activeTab === "quiz" ? "/learning/quizzes" : activeTab === "video" ? "/learning/videos" : "/learning/training-items";
    let payload: any;
    if (activeTab === "quiz") {
      payload = {
        title: quizForm.title,
        description: quizForm.description,
        questions_per_user: quizForm.questionsPerUser,
        time_limit: quizForm.timeLimit,
        pass_percentage: quizForm.passPercentage,
        allow_skip_questions: quizForm.allowSkip,
        certificate_enabled: quizForm.issueCertificate,
        certificate_validity_value: quizForm.validityPeriod,
        certificate_validity_unit: quizForm.validityUnit,
        access_mode: quizForm.accessMode,
        reassign_on_fail: quizForm.reassignOnFail,
        reschedule_days: quizForm.rescheduleDays,
        questions: quizForm.questions,
        selected_users: quizForm.selectedUsers,
        selected_groups: [],
        selected_locations: [],
        is_draft: false,
      };
    } else if (activeTab === "video") {
      payload = {
        title: videoForm.title,
        description: videoForm.description || "",
        video_source: videoForm.videoSource,
        questions_per_user: videoForm.questionsPerUser,
        time_limit: videoForm.timeLimit,
        pass_percentage: videoForm.passPercentage,
        allow_skip_questions: videoForm.allowSkip,
        certificate_enabled: videoForm.issueCertificate,
        certificate_validity_value: videoForm.validityPeriod,
        certificate_validity_unit: videoForm.validityUnit,
        access_mode: videoForm.accessMode,
        reassign_on_fail: videoForm.reassignOnFail,
        reschedule_days: videoForm.rescheduleDays,
        questions: videoForm.questions,
        selected_users: videoForm.selectedUsers,
        selected_groups: [],
        selected_locations: [],
        is_draft: false,
      };
      if (videoForm.videoUrl) payload.video_url = videoForm.videoUrl;
      if (videoForm.videoFile) {
        const fd = new FormData();
        Object.keys(payload).forEach(key => {
          if (payload[key] === null || payload[key] === undefined) return;
          if (typeof payload[key] === "object") fd.append(key, JSON.stringify(payload[key]));
          else fd.append(key, payload[key]);
        });
        fd.append("video_file", videoForm.videoFile);
        payload = fd;
      }
    } else {
      payload = {
        title: trainingForm.title,
        description: trainingForm.description,
        asset_type: trainingForm.assetType,
        source_type: trainingForm.sourceType,
        file_url: trainingForm.fileUrl || null,
        content_url: trainingForm.fileUrl || null,
        allow_download: trainingForm.allowDownload,
        allow_print: trainingForm.allowPrint,
        allow_share: trainingForm.allowShare,
        follow_up_type: trainingForm.followUpType || null,
        follow_up_id: trainingForm.followUpId || null,
        questions_per_user: trainingForm.questionsPerUser,
        time_limit: trainingForm.timeLimit,
        pass_percentage: trainingForm.passPercentage,
        allow_skip_questions: trainingForm.allowSkip,
        certificate_enabled: trainingForm.issueCertificate,
        certificate_validity_value: trainingForm.validityPeriod,
        certificate_validity_unit: trainingForm.validityUnit,
        access_mode: trainingForm.accessMode,
        reassign_on_fail: trainingForm.reassignOnFail,
        reschedule_days: trainingForm.rescheduleDays,
        questions: trainingForm.questions,
        selected_users: trainingForm.selectedUsers,
        selected_groups: [],
        selected_locations: [],
        is_draft: false,
      };
      if (trainingForm.file) {
        const fd = new FormData();
        Object.keys(payload).forEach(key => {
          if (payload[key] === null || payload[key] === undefined) return;
          if (typeof payload[key] === "object") fd.append(key, JSON.stringify(payload[key]));
          else fd.append(key, payload[key]);
        });
        fd.append("file", trainingForm.file);
        payload = fd;
      }
    }
    try {
      const isFormData = payload instanceof FormData;
      const config = isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined;
      if (editingItem) { await axiosInstance.patch(`${endpoint}/${editingItem.id}/`, payload, config); }
      else { await axiosInstance.post(`${endpoint}/`, payload, config); }
      setShowForm(false); fetchAll();
    } catch (e: any) {
      console.error("Save failed. Full response:", JSON.stringify(e.response?.data, null, 2));
      const errData = e.response?.data;
      let errMsg = "Error";
      if (errData) {
        errMsg = Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("; ");
      }
      alert("Failed to save: " + errMsg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    const endpoint = activeTab === "quiz" ? "/learning/quizzes" : activeTab === "video" ? "/learning/videos" : "/learning/training-items";
    try { await axiosInstance.delete(`${endpoint}/${id}/`); fetchAll(); } catch (e) { alert("Failed to delete"); }
  };

  const openShare = (item: any) => {
    setShareItem(item);
    setShareUserIds(item.selected_users || []);
    setShareGroupIds(item.selected_groups || []);
    setShareLocationIds(item.selected_locations || []);
    setShareTab("users");
    setShowShareModal(true);
  };

  const handleShare = async () => {
    if (!shareItem) return;
    const endpoint = activeTab === "quiz" ? "/learning/quizzes" : activeTab === "video" ? "/learning/videos" : "/learning/training-items";
    try {
      await axiosInstance.patch(`${endpoint}/${shareItem.id}/`, {
        selected_users: shareUserIds,
        selected_groups: shareGroupIds,
        selected_locations: shareLocationIds,
      });
      setShowShareModal(false); fetchAll();
    } catch (e: any) { alert("Failed to share: " + (e.response?.data?.detail || "Error")); }
  };

  const toggleUser = (userId: string) => {
    setShareUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };
  const toggleGroup = (groupId: string) => {
    setShareGroupIds(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
  };
  const toggleLocation = (locId: string) => {
    setShareLocationIds(prev => prev.includes(locId) ? prev.filter(id => id !== locId) : [...prev, locId]);
  };

  const handleView = (item: any) => {
    setViewItem(item);
    setShowViewModal(true);
  };

  const handleShowUserDetails = async (item: any) => {
    try {
      const res = await axiosInstance.get(`/learning/courses/results-by-content/?content_id=${item.id}`);
      const attempted = Array.isArray(res.data) ? res.data : []
        .map((r: any) => {
          const user = users.find((u: any) => String(u.id) === String(r.user_id));
          return {
            id: r.user_id,
            name: r.user_name || user?.name || "Unknown",
            email: r.user_email || user?.email || "",
            department: r.user_department || user?.department || "",
            score: r.score || 0,
            correctAnswers: r.correct_answers,
            totalQuestions: r.total_questions,
            passPercentage: r.pass_percentage || 70,
            passed: r.passed,
            completedAt: r.completed_at,
            timeTaken: r.time_taken || 0,
          };
        });
      const shared = (item.selected_users || []).map((userId: string) => {
        const user = users.find((u: any) => String(u.id) === String(userId));
        return user || { id: userId, name: "Unknown", email: "", department: "" };
      });
      setUserDetails({ shared, attempted, title: item.title });
      setShowUserDetailsModal(true);
    } catch (e) {
      const shared = (item.selected_users || []).map((userId: string) => {
        const user = users.find((u: any) => String(u.id) === String(userId));
        return user || { id: userId, name: "Unknown", email: "", department: "" };
      });
      setUserDetails({ shared, attempted: [], title: item.title });
      setShowUserDetailsModal(true);
    }
  };

  const tabs = [
    { key: "quiz", label: "Quiz Management", icon: BookOpen },
    { key: "video", label: "Video Training", icon: Video },
    { key: "training", label: "Training Documents & Videos", icon: FileText },
  ];

  const renderCertificateConfig = (form: any, setForm: any) => (
    <div className="border-t pt-6">
      <h3 className="text-md font-semibold text-gray-900 mb-4">Certificate Configuration</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Issue Certificate</label>
          <select value={form.issueCertificate ? "yes" : "no"} onChange={(e) => setForm({ ...form, issueCertificate: e.target.value === "yes" })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="no">No - No certificate</option>
            <option value="yes">Yes - Issue on pass</option>
          </select>
        </div>
        {form.issueCertificate && (<>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Validity Period</label>
            <input type="number" min="0" value={form.validityPeriod ?? 1} onChange={(e) => setForm({ ...form, validityPeriod: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Validity Unit</label>
            <select value={form.validityUnit || "years"} onChange={(e) => setForm({ ...form, validityUnit: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="days">Days</option><option value="months">Months</option><option value="years">Years</option>
            </select>
          </div>
        </>)}
      </div>
    </div>
  );

  const renderAccessMode = (form: any, setForm: any) => (
    <div className="border-t pt-6">
      <h3 className="text-md font-semibold text-gray-900 mb-4">Access Mode</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">User Access Type</label>
          <select value={form.accessMode || "permanent"} onChange={(e) => setForm({ ...form, accessMode: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="permanent">Permanent - Always Available</option>
            <option value="one-time">One-Time - Single Attempt Only</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">{form.accessMode === "one-time" ? "Users can only take this quiz once." : "Users can access this quiz multiple times."}</p>
        </div>
      </div>
    </div>
  );

  const renderReassignment = (form: any, setForm: any) => (
    <div className="border-t pt-6">
      <h3 className="text-md font-semibold text-gray-900 mb-4">Reassignment on Failure</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Re-assign on Fail</label>
          <select value={form.reassignOnFail ? "yes" : "no"} onChange={(e) => setForm({ ...form, reassignOnFail: e.target.value === "yes" })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="no">No - Keep quiz available</option>
            <option value="yes">Yes - Reassign training after fail</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">{form.reassignOnFail ? "User must re-complete training before retest." : "User can retake quiz immediately."}</p>
        </div>
        {form.reassignOnFail && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reschedule After (Days)</label>
            <input type="number" min="0" max="365" value={form.rescheduleDays ?? 7} onChange={(e) => setForm({ ...form, rescheduleDays: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-500 mt-1">Days to wait before user can retake quiz.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderQuizConfigFields = (form: any, setForm: any, skipId: string) => (
    <div className="border-t pt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quiz Configuration</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Questions Per User</label>
          <input type="number" min="1" value={form.questionsPerUser ?? 15} onChange={(e) => setForm({ ...form, questionsPerUser: parseInt(e.target.value) || 15 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (minutes)</label>
          <input type="number" min="0" value={form.timeLimit ?? 30} onChange={(e) => setForm({ ...form, timeLimit: parseInt(e.target.value) || 30 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pass Percentage (%)</label>
          <input type="number" min="0" max="100" value={form.passPercentage ?? 70} onChange={(e) => setForm({ ...form, passPercentage: parseInt(e.target.value) || 70 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex items-center mt-4">
        <input type="checkbox" id={skipId} checked={form.allowSkip || false} onChange={(e) => setForm({ ...form, allowSkip: e.target.checked })} className="mr-2" />
        <label htmlFor={skipId} className="text-sm text-gray-700">Allow users to skip questions</label>
      </div>
    </div>
  );

  const renderFormButtons = (label: string) => (
    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
      <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
      <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        <Save className="w-4 h-4" /> {label}
      </button>
    </div>
  );

  const renderQuizForm = () => (
    <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title *</label>
          <input type="text" required value={quizForm.title || ""} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter quiz title" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={quizForm.description || ""} rows={3} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter quiz description" />
        </div>
      </div>
      {renderQuizConfigFields(quizForm, setQuizForm, "quizAllowSkip")}
      {renderCertificateConfig(quizForm, setQuizForm)}
      {renderAccessMode(quizForm, setQuizForm)}
      {renderReassignment(quizForm, setQuizForm)}
      <QuestionBuilder questions={quizForm.questions} onQuestionsChange={(qs) => setQuizForm({ ...quizForm, questions: qs })} />
      {renderFormButtons(editingItem ? "Update Quiz" : "Save Quiz")}
    </form>
  );

  const renderVideoForm = () => (
    <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Video Title *</label>
          <input type="text" required value={videoForm.title || ""} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter video title" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={videoForm.description || ""} rows={3} onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter video description" />
        </div>
      </div>
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Video Source</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source Type</label>
            <select value={videoForm.videoSource || "url"} onChange={(e) => setVideoForm({ ...videoForm, videoSource: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="url">URL (YouTube, Vimeo, etc.)</option>
              <option value="file">Upload File</option>
            </select>
          </div>
          {videoForm.videoSource === "url" ? (
            <div key="video-url">
              <label className="block text-sm font-medium text-gray-700 mb-2">Video URL</label>
              <input type="url" value={videoForm.videoUrl || ""} onChange={(e) => setVideoForm({ ...videoForm, videoUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="https://youtube.com/watch?v=..." />
            </div>
          ) : (
            <div key="video-file">
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Video File</label>
              <input type="file" accept="video/*" onChange={(e) => setVideoForm({ ...videoForm, videoFile: e.target.files?.[0] || null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              {videoForm.videoFile && <p className="mt-2 text-sm text-gray-600 flex items-center gap-1"><FileUp className="w-4 h-4" /> {videoForm.videoFile.name} ({(videoForm.videoFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
            </div>
          )}
        </div>
      </div>
      {renderQuizConfigFields(videoForm, setVideoForm, "videoAllowSkip")}
      {renderCertificateConfig(videoForm, setVideoForm)}
      {renderAccessMode(videoForm, setVideoForm)}
      {renderReassignment(videoForm, setVideoForm)}
      <QuestionBuilder questions={videoForm.questions} onQuestionsChange={(qs) => setVideoForm({ ...videoForm, questions: qs })} />
      {renderFormButtons(editingItem ? "Update Video" : "Save Video")}
    </form>
  );

  const renderTrainingForm = () => (
    <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Training Title *</label>
          <input type="text" required value={trainingForm.title || ""} onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter training title" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={trainingForm.description || ""} rows={3} onChange={(e) => setTrainingForm({ ...trainingForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter training description" />
        </div>
      </div>
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Asset Type</label>
            <select value={trainingForm.assetType || "document"} onChange={(e) => setTrainingForm({ ...trainingForm, assetType: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="document">Document (PDF, DOC, PPT)</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source Type</label>
            <select value={trainingForm.sourceType || "url"} onChange={(e) => setTrainingForm({ ...trainingForm, sourceType: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="url">URL Link</option>
              <option value="file">Upload File</option>
            </select>
          </div>
          {trainingForm.sourceType === "url" ? (
            <div key="training-url" className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Content URL</label>
              <input type="url" value={trainingForm.fileUrl || ""} onChange={(e) => setTrainingForm({ ...trainingForm, fileUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
            </div>
          ) : (
            <div key="training-file" className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload File</label>
              <input type="file" accept={trainingForm.assetType === "video" ? "video/*" : ".pdf,.doc,.docx,.ppt,.pptx"} onChange={(e) => setTrainingForm({ ...trainingForm, file: e.target.files?.[0] || null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              {trainingForm.file && <p className="mt-2 text-sm text-gray-600 flex items-center gap-1"><FileUp className="w-4 h-4" /> {trainingForm.file.name} ({(trainingForm.file.size / 1024 / 1024).toFixed(2)} MB)</p>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="flex items-center"><input type="checkbox" id="allowDownload" checked={trainingForm.allowDownload || false} onChange={(e) => setTrainingForm({ ...trainingForm, allowDownload: e.target.checked })} className="mr-2" /><label htmlFor="allowDownload" className="text-sm text-gray-700">Allow Download</label></div>
          <div className="flex items-center"><input type="checkbox" id="allowPrint" checked={trainingForm.allowPrint || false} onChange={(e) => setTrainingForm({ ...trainingForm, allowPrint: e.target.checked })} className="mr-2" /><label htmlFor="allowPrint" className="text-sm text-gray-700">Allow Print</label></div>
          <div className="flex items-center"><input type="checkbox" id="allowShare" checked={trainingForm.allowShare || false} onChange={(e) => setTrainingForm({ ...trainingForm, allowShare: e.target.checked })} className="mr-2" /><label htmlFor="allowShare" className="text-sm text-gray-700">Allow Share</label></div>
        </div>
      </div>
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Follow-up Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Type</label>
            <select value={trainingForm.followUpType || ""} onChange={(e) => setTrainingForm({ ...trainingForm, followUpType: e.target.value, followUpId: "" })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="">None</option><option value="quiz">Quiz</option><option value="video">Video</option>
            </select>
          </div>
          {trainingForm.followUpType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select {trainingForm.followUpType === "quiz" ? "Quiz" : "Video"}</label>
              <select value={trainingForm.followUpId || ""} onChange={(e) => setTrainingForm({ ...trainingForm, followUpId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="">Select...</option>
                {(trainingForm.followUpType === "quiz" ? quizzes : videos).map((item: any) => (<option key={item.id} value={item.id}>{item.title}</option>))}
              </select>
            </div>
          )}
        </div>
      </div>
      {trainingForm.followUpType && (
        <div className="border-t pt-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4">Follow-up Quiz Settings</h3>
          <div className="flex items-center">
            <input type="checkbox" id="trainingAllowSkip" checked={trainingForm.allowSkip || false} onChange={(e) => setTrainingForm({ ...trainingForm, allowSkip: e.target.checked })} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
            <label htmlFor="trainingAllowSkip" className="ml-2 block text-sm text-gray-700">Allow Skip Questions in Follow-up Quiz</label>
          </div>
        </div>
      )}
      {renderCertificateConfig(trainingForm, setTrainingForm)}
      {renderAccessMode(trainingForm, setTrainingForm)}
      {renderReassignment(trainingForm, setTrainingForm)}
      <div className="border-t pt-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Assign to Users</h3>
        {users.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No users available. Add users first to assign this training.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg">
            {users.map((user: any) => (
              <label key={user.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={trainingForm.selectedUsers.includes(String(user.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTrainingForm({ ...trainingForm, selectedUsers: [...trainingForm.selectedUsers, String(user.id)] });
                    } else {
                      setTrainingForm({ ...trainingForm, selectedUsers: trainingForm.selectedUsers.filter((id: string) => id !== String(user.id)) });
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{user.first_name} {user.last_name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      {renderFormButtons(editingItem ? "Update Training" : "Save Training")}
    </form>
  );

  return (
    <LearningLayout title="L&T Module" description="Create and manage learning content">
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setShowForm(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab.key ? "bg-[#3A72EC] text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#3A72EC] text-white rounded-lg hover:bg-[#2a5dbf] transition-colors text-sm font-medium">
          <Plus className="h-4 w-4" /> Create New {activeTab === "quiz" ? "Quiz" : activeTab === "video" ? "Video" : "Training Item"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white rounded-t-lg">
              <h2 className="text-xl font-semibold text-gray-900">{editingItem ? "Edit" : "Create"} {activeTab === "quiz" ? "Quiz" : activeTab === "video" ? "Video" : "Training Item"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            {activeTab === "quiz" && renderQuizForm()}
            {activeTab === "video" && renderVideoForm()}
            {activeTab === "training" && renderTrainingForm()}
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Share2 className="w-5 h-5" /> Share Content</h2>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Share "{shareItem?.title}" with users, groups, or locations:</p>

            {/* Share tabs */}
            <div className="flex gap-2 mb-3">
              <button onClick={() => setShareTab("users")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${shareTab === "users" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                <Users className="w-4 h-4" /> Users {shareUserIds.length > 0 && <span className="ml-1 bg-white/20 px-1.5 rounded-full text-xs">{shareUserIds.length}</span>}
              </button>
              <button onClick={() => setShareTab("groups")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${shareTab === "groups" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                <Building2 className="w-4 h-4" /> Groups {shareGroupIds.length > 0 && <span className="ml-1 bg-white/20 px-1.5 rounded-full text-xs">{shareGroupIds.length}</span>}
              </button>
              <button onClick={() => setShareTab("locations")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${shareTab === "locations" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                <MapPin className="w-4 h-4" /> Locations {shareLocationIds.length > 0 && <span className="ml-1 bg-white/20 px-1.5 rounded-full text-xs">{shareLocationIds.length}</span>}
              </button>
            </div>

            {/* Share list */}
            <div className="max-h-64 overflow-y-auto border rounded-lg p-3 space-y-1">
              {shareTab === "users" && (
                users.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No users available</p> :
                users.map((user: any) => (
                  <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" checked={shareUserIds.includes(String(user.id))} onChange={() => toggleUser(String(user.id))} className="rounded text-blue-600" />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">{(user.first_name?.[0] || "").toUpperCase()}{(user.last_name?.[0] || "").toUpperCase()}</div>
                      <div>
                        <p className="text-sm text-gray-800">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </label>
                ))
              )}
              {shareTab === "groups" && (
                groups.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No groups available</p> :
                groups.map((group: any) => (
                  <label key={group.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" checked={shareGroupIds.includes(String(group.id))} onChange={() => toggleGroup(String(group.id))} className="rounded text-blue-600" />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center"><Building2 className="w-3.5 h-3.5 text-purple-700" /></div>
                      <span className="text-sm text-gray-800">{group.name}</span>
                    </div>
                  </label>
                ))
              )}
              {shareTab === "locations" && (
                locations.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No locations available</p> :
                locations.map((loc: any) => (
                  <label key={loc.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" checked={shareLocationIds.includes(String(loc.id))} onChange={() => toggleLocation(String(loc.id))} className="rounded text-blue-600" />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center"><MapPin className="w-3.5 h-3.5 text-green-700" /></div>
                      <span className="text-sm text-gray-800">{loc.name}</span>
                    </div>
                  </label>
                ))
              )}
            </div>

            {/* Summary */}
            <div className="mt-3 text-xs text-gray-500">
              {shareUserIds.length + shareGroupIds.length + shareLocationIds.length} selection(s): {shareUserIds.length} users, {shareGroupIds.length} groups, {shareLocationIds.length} locations
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowShareModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Share2 className="w-4 h-4" /> Share</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Title</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Type</th>
                {activeTab === "training" && <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Follow-up</th>}
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Questions</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Time</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Pass %</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Shared</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Attempted</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === "training" ? 10 : 9} className="text-center py-10 text-gray-500">No {activeTab === "quiz" ? "quizzes" : activeTab === "video" ? "videos" : "training items"} yet.</td>
                </tr>
              ) : currentItems.map((item) => {
                const totalQuestions = Array.isArray(item.questions) ? item.questions.length : 0;
                const perUser = item.questions_per_user || item.questionsPerUser || 0;
                const timeLimit = item.time_limit || item.timeLimit || 0;
                const passPct = item.pass_percentage || item.passPercentage || 0;
                const sharedCount = (Array.isArray(item.selected_users) ? item.selected_users.length : 0) + (Array.isArray(item.selected_groups) ? item.selected_groups.length : 0) + (Array.isArray(item.selected_locations) ? item.selected_locations.length : 0);
                const isDraft = item.is_draft;
                const attemptedCount = attemptedCounts[item.id] || 0;
                let typeBadge;
                if (activeTab === "quiz") {
                  typeBadge = <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">Quiz</span>;
                } else if (activeTab === "video") {
                  typeBadge = <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Video</span>;
                } else {
                  const isVideo = item.asset_type === "video";
                  typeBadge = <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isVideo ? "bg-green-50 text-green-700" : "bg-indigo-50 text-indigo-700"}`}>
                    {isVideo ? <Video className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                    {isVideo ? "Video" : "Document"}
                  </span>;
                }
                const followUpLabel = activeTab === "training" ? (item.follow_up_type === "video" ? "Video Training" : item.follow_up_type === "quiz" ? "Quiz" : "None") : null;
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{item.title}</div>
                      {item.description && <div className="text-xs text-gray-500 truncate max-w-xs mt-0.5">{item.description}</div>}
                    </td>
                    <td className="px-4 py-3">{typeBadge}</td>
                    {activeTab === "training" && <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{followUpLabel}</td>}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {activeTab === "video" && !totalQuestions ? "—" : `${totalQuestions} total${perUser ? ` / ${perUser} per user` : ""}`}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{timeLimit ? `${timeLimit} min` : "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{passPct ? `${passPct}%` : "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {sharedCount > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-700">{sharedCount} shared</span>
                          {Array.isArray(item.selected_users) && item.selected_users.length > 0 && <span className="inline-flex items-center gap-0.5 text-xs text-green-600" title={`${item.selected_users.length} users`}><Users className="w-3 h-3" />{item.selected_users.length}</span>}
                          {Array.isArray(item.selected_groups) && item.selected_groups.length > 0 && <span className="inline-flex items-center gap-0.5 text-xs text-purple-600" title={`${item.selected_groups.length} groups`}><Building2 className="w-3 h-3" />{item.selected_groups.length}</span>}
                          {Array.isArray(item.selected_locations) && item.selected_locations.length > 0 && <span className="inline-flex items-center gap-0.5 text-xs text-teal-600" title={`${item.selected_locations.length} locations`}><MapPin className="w-3 h-3" />{item.selected_locations.length}</span>}
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{attemptedCount > 0 ? `${attemptedCount} attempted` : <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDraft ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>{isDraft ? "Draft" : "Active"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => handleView(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Details">
                          <FileSpreadsheet className="h-4 w-4" />
                        </button>
                        <button onClick={() => openShare(item)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Share">
                          <Share2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleShowUserDetails(item)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="View Shared & Attempted Users">
                          <Users className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEdit(item)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {showViewModal && viewItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-xl font-semibold text-gray-900">{viewItem.title}</h2>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-5 space-y-2">
                <p className="text-sm text-slate-600"><strong>Description:</strong> {viewItem.description || "No description"}</p>
                {activeTab === "training" && (<>
                  <p className="text-sm text-slate-600"><strong>Asset Type:</strong> {viewItem.asset_type === "video" ? "Video" : "Document"}</p>
                  <p className="text-sm text-slate-600"><strong>Source:</strong> {viewItem.source_type === "file" ? "Uploaded File" : "URL"}</p>
                  <p className="text-sm text-slate-600"><strong>Follow-up:</strong> {viewItem.follow_up_type === "video" ? "Video Training" : viewItem.follow_up_type === "quiz" ? "Quiz" : "None"}</p>
                </>)}
                <p className="text-sm text-slate-600"><strong>Questions:</strong> {Array.isArray(viewItem.questions) ? viewItem.questions.length : 0}</p>
                <p className="text-sm text-slate-600"><strong>Time Limit:</strong> {viewItem.time_limit || viewItem.timeLimit || 30} minutes</p>
                <p className="text-sm text-slate-600"><strong>Per User:</strong> {viewItem.questions_per_user || viewItem.questionsPerUser || 15} per user</p>
                <p className="text-sm text-slate-600"><strong>Pass Percentage:</strong> {viewItem.pass_percentage || viewItem.passPercentage || 70}%</p>
                <p className="text-sm text-slate-600"><strong>Access Mode:</strong> {viewItem.access_mode || "permanent"}</p>
                <p className="text-sm text-slate-600"><strong>Assigned Users:</strong> {(viewItem.selected_users || []).length}</p>
              </div>
              {Array.isArray(viewItem.questions) && viewItem.questions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-md font-semibold text-gray-900">Questions</h3>
                  {viewItem.questions.map((q: any, index: number) => (
                    <div key={q.id || index} className="border border-gray-200 rounded-xl p-4 bg-slate-50">
                      <h4 className="font-semibold text-slate-900 mb-2">Question {index + 1}
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {q.type === "truefalse" ? "True/False" : q.type === "fillblank" ? "Fill Blank" : q.type === "nps" ? "NPS Scale" : "MCQ"}
                        </span>
                      </h4>
                      <p className="text-sm text-slate-700 mb-2">{q.question}</p>
                      {q.type === "fillblank" ? (
                        <div className="rounded-lg p-3 bg-emerald-100 border border-emerald-200">
                          <span className="text-sm font-semibold text-slate-900">Correct Answer: </span>
                          <span className="text-sm text-slate-700">{q.correctText}</span>
                        </div>
                      ) : q.type === "nps" ? (
                        <div className="rounded-lg p-3 bg-white border border-slate-200">
                          <span className="text-sm font-semibold text-slate-900">Scale: {q.npsMin || 0} - {q.npsMax || 10}</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {(q.displayOptions || q.options || []).map((opt: any, i: number) => (
                            <div key={i} className={`text-sm px-3 py-1.5 rounded-lg ${i === (q.correctAnswer ?? -1) ? "bg-emerald-100 text-emerald-800 font-medium" : "bg-white text-slate-700"}`}>
                              {String.fromCharCode(65 + i)}. {opt}
                              {i === (q.correctAnswer ?? -1) && <span className="ml-2 text-xs">✓ Correct</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowViewModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showUserDetailsModal && userDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">User Details - {userDetails.title}</h2>
                <p className="mt-1 text-sm text-gray-500">View shared users and their attempt status</p>
              </div>
              <button onClick={() => setShowUserDetailsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6">
                <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Shared Users ({userDetails.shared.length})
                </h3>
                {userDetails.shared.length === 0 ? (
                  <div className="text-sm text-gray-500 italic">No users shared with this content.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Name</th>
                          <th className="px-4 py-2 font-semibold">Email</th>
                          <th className="px-4 py-2 font-semibold">Department</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {userDetails.shared.map((user: any) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{user.name}</td>
                            <td className="px-4 py-2">{user.email || "-"}</td>
                            <td className="px-4 py-2">{user.department || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Attempted Users ({userDetails.attempted.length})
                </h3>
                {userDetails.attempted.length === 0 ? (
                  <div className="text-sm text-gray-500 italic">No users have attempted this content yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Name</th>
                          <th className="px-4 py-2 font-semibold">Email</th>
                          <th className="px-4 py-2 font-semibold">Department</th>
                          <th className="px-4 py-2 font-semibold">Score</th>
                          <th className="px-4 py-2 font-semibold">Status</th>
                          <th className="px-4 py-2 font-semibold">Date</th>
                          <th className="px-4 py-2 font-semibold">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {userDetails.attempted.map((user: any, idx: number) => (
                          <tr key={`${user.id}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{user.name}</td>
                            <td className="px-4 py-2">{user.email || "-"}</td>
                            <td className="px-4 py-2">{user.department || "-"}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">{user.score}%</span>
                                {user.totalQuestions && (
                                  <span className="text-xs text-gray-500">({user.correctAnswers}/{user.totalQuestions})</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                {user.passed ? "Passed" : "Failed"}
                              </span>
                            </td>
                            <td className="px-4 py-2">{user.completedAt ? new Date(user.completedAt).toLocaleString() : "-"}</td>
                            <td className="px-4 py-2">{user.timeTaken ? `${Math.round(user.timeTaken / 60)}m ${user.timeTaken % 60}s` : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowUserDetailsModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </LearningLayout>
  );
}
