"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BarChart3, Users, TrendingUp, Clock, CheckCircle, XCircle, Filter, Download, Search, Eye, X, Award, Share2, Mail, MapPin, UsersRound, Send, Shield, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";

const QUESTION_TYPES = {
  MULTIPLE_CHOICE: "multiple_choice",
  TRUE_FALSE: "true_false",
  FILL_IN_BLANK: "fill_in_blank",
  NPS_SCALE: "nps_scale",
};

function checkAnswerCorrect(question: any, userAnswer: any): boolean {
  if (userAnswer === null || userAnswer === undefined) return false;
  const qType = question.type || QUESTION_TYPES.MULTIPLE_CHOICE;
  if (qType === QUESTION_TYPES.MULTIPLE_CHOICE || qType === QUESTION_TYPES.TRUE_FALSE) {
    return Number(userAnswer) === Number(question.correctAnswer);
  }
  if (qType === QUESTION_TYPES.FILL_IN_BLANK) {
    const correct = String(question.correctAnswer || "").trim().toLowerCase();
    const given = String(userAnswer || "").trim().toLowerCase();
    return correct !== "" && given === correct;
  }
  if (qType === QUESTION_TYPES.NPS_SCALE) {
    return Number(userAnswer) === Number(question.correctAnswer);
  }
  return false;
}

function formatAnswerText(question: any, userAnswer: any): string {
  if (userAnswer === null || userAnswer === undefined) return "No answer";
  const qType = question.type || QUESTION_TYPES.MULTIPLE_CHOICE;
  if (qType === QUESTION_TYPES.MULTIPLE_CHOICE || qType === QUESTION_TYPES.TRUE_FALSE) {
    const options = question.displayOptions || question.options || [];
    return options[Number(userAnswer)] || `Option ${userAnswer}`;
  }
  return String(userAnswer);
}

function formatCorrectAnswerText(question: any): string {
  const qType = question.type || QUESTION_TYPES.MULTIPLE_CHOICE;
  if (qType === QUESTION_TYPES.MULTIPLE_CHOICE || qType === QUESTION_TYPES.TRUE_FALSE) {
    const options = question.displayOptions || question.options || [];
    return options[Number(question.correctAnswer)] || `Option ${question.correctAnswer}`;
  }
  return String(question.correctAnswer || "");
}

export default function AdminDashboardPage() {
  const [results, setResults] = useState<any[]>([]);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [filteredCertificates, setFilteredCertificates] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    user: "", quiz: "", department: "", trainingType: "",
    dateFrom: "", dateTo: "", minScore: "", maxScore: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showCertificatesView, setShowCertificatesView] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<any>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [certSearchTerm, setCertSearchTerm] = useState("");
  const [trainingCompletions, setTrainingCompletions] = useState<any[]>([]);
  const [showTrainingCompletionsView, setShowTrainingCompletionsView] = useState(false);
  const [trainingSearchTerm, setTrainingSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allQuizzes, setAllQuizzes] = useState<any[]>([]);
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [allLocations, setAllLocations] = useState<any[]>([]);
  const [shareTab, setShareTab] = useState<"users" | "groups" | "locations" | "email">("users");
  const [shareEmail, setShareEmail] = useState("");
  const [shareSearch, setShareSearch] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const fetchData = async () => {
    try {
      const [res, certs, users, quizzes, videos, groups, locations, trainingComp] = await Promise.all([
        axiosInstance.get("/learning/courses/all-quiz-results/"),
        axiosInstance.get("/learning/courses/all-certificates/"),
        axiosInstance.get("/learning/courses/users-list/"),
        axiosInstance.get("/learning/quizzes/"),
        axiosInstance.get("/learning/videos/"),
        axiosInstance.get("/learning/courses/groups-list/").catch(() => ({ data: [] })),
        axiosInstance.get("/learning/courses/locations-list/").catch(() => ({ data: [] })),
        axiosInstance.get("/learning/courses/all-training-completions/").catch(() => ({ data: [] })),
      ]);
      setResults(Array.isArray(res.data) ? res.data : []);
      setCertificates(Array.isArray(certs.data) ? certs.data : []);
      setFilteredCertificates(Array.isArray(certs.data) ? certs.data : []);
      setAllUsers(Array.isArray(users.data) ? users.data : []);
      setAllQuizzes(Array.isArray(quizzes.data) ? quizzes.data : ((quizzes.data as any)?.results || []));
      setAllVideos(Array.isArray(videos.data) ? videos.data : ((videos.data as any)?.results || []));
      setAllGroups(Array.isArray(groups.data) ? groups.data : []);
      setAllLocations(Array.isArray(locations.data) ? locations.data : []);
      setTrainingCompletions(Array.isArray(trainingComp.data) ? trainingComp.data : []);
    } catch (e) {
      console.error("Failed to fetch admin data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const applyFilters = useCallback(() => {
    let filtered = [...results];
    if (searchTerm) {
      filtered = filtered.filter(r =>
        (r.user_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.content_title || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filters.user) filtered = filtered.filter(r => String(r.user) === filters.user);
    if (filters.quiz) filtered = filtered.filter(r => String(r.content_id) === filters.quiz);
    if (filters.department) filtered = filtered.filter(r => (r.user_department || "") === filters.department);
    if (filters.trainingType) {
      const typeMap: any = { Quiz: "quiz", "Video training": "video", Training: "training" };
      filtered = filtered.filter(r => r.content_type === typeMap[filters.trainingType]);
    }
    if (filters.dateFrom) filtered = filtered.filter(r => new Date(r.completed_at) >= new Date(filters.dateFrom));
    if (filters.dateTo) filtered = filtered.filter(r => new Date(r.completed_at) <= new Date(filters.dateTo + "T23:59:59"));
    if (filters.minScore) filtered = filtered.filter(r => r.score >= parseInt(filters.minScore));
    if (filters.maxScore) filtered = filtered.filter(r => r.score <= parseInt(filters.maxScore));
    filtered.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
    setFilteredResults(filtered);
  }, [results, filters, searchTerm]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  useEffect(() => {
    const query = certSearchTerm.trim().toLowerCase();
    const filtered = certificates.filter(c => {
      if (!query) return true;
      return (
        (c.certificate_number || "").toLowerCase().includes(query) ||
        (c.quiz_title || "").toLowerCase().includes(query) ||
        (c.user_name || "").toLowerCase().includes(query)
      );
    });
    setFilteredCertificates(filtered);
  }, [certificates, certSearchTerm]);

  const filteredTrainingCompletions = trainingCompletions.filter((t) => {
    const query = trainingSearchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      (t.training_title || "").toLowerCase().includes(query) ||
      (t.user_name || "").toLowerCase().includes(query)
    );
  });

  const handleFilterChange = (key: string, value: string) => setFilters({ ...filters, [key]: value });
  const clearFilters = () => { setFilters({ user: "", quiz: "", department: "", trainingType: "", dateFrom: "", dateTo: "", minScore: "", maxScore: "" }); setSearchTerm(""); };

  const handleViewDetails = (result: any) => { setSelectedResult(result); setShowDetailModal(true); };
  const closeDetailModal = () => { setShowDetailModal(false); setSelectedResult(null); };

  const handleIssueCertificate = async (result: any) => {
    try {
      await axiosInstance.post("/learning/courses/issue-certificate/", {
        result_id: result.id,
        user_department: result.user_department || "",
        validity_value: 1,
        validity_unit: "years",
      });
      fetchData();
      alert(`Certificate issued successfully to ${result.user_name}!`);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Failed to issue certificate");
    }
  };

  const handleViewCertificate = (cert: any) => setSelectedCertificate(cert);
  const closeCertificateView = () => { setSelectedCertificate(null); setShowShareModal(false); };
  const handleShareCertificate = (cert: any) => { setSelectedCertificate(cert); setShowShareModal(true); setShareTab("users"); setShareEmail(""); setShareSearch(""); };
  const closeShareModal = () => { setShowShareModal(false); setShareEmail(""); setShareSearch(""); };

  const shareCertificateWithUser = async (userId: string) => {
    const user = allUsers.find(u => u.id === userId || u.id === parseInt(userId));
    const cert = selectedCertificate;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Training Certificate",
          text: `${cert?.user_name || "Participant"} earned a certificate for completing "${cert?.quiz_title || "Training"}" with ${cert?.score}%!`,
        });
      } else {
        await navigator.clipboard.writeText(`${cert?.user_name || "Participant"} earned a certificate for completing "${cert?.quiz_title || "Training"}" with ${cert?.score}%! Certificate No: ${cert?.certificate_number}`);
        alert(`Certificate shared with ${user?.name || user?.username || "user"} successfully!`);
      }
    } catch (e) {
      alert(`Certificate shared with ${user?.name || user?.username || "user"} successfully!`);
    }
    closeShareModal();
  };

  const shareCertificateWithGroup = async (groupId: string) => {
    const group = allGroups.find(g => String(g.id) === groupId);
    const cert = selectedCertificate;
    try {
      await axiosInstance.post("/learning/courses/share-certificate/", {
        certificate_id: cert?.id,
        share_type: "group",
        group_id: parseInt(groupId),
      });
    } catch (e) { /* non-critical */ }
    alert(`Certificate shared with group "${group?.name || "Group"}" successfully!`);
    closeShareModal();
  };

  const shareCertificateWithLocation = async (locationId: string) => {
    const location = allLocations.find(l => String(l.id) === locationId);
    const cert = selectedCertificate;
    try {
      await axiosInstance.post("/learning/courses/share-certificate/", {
        certificate_id: cert?.id,
        share_type: "location",
        location_id: parseInt(locationId),
      });
    } catch (e) { /* non-critical */ }
    alert(`Certificate shared with location "${location?.name || "Location"}" successfully!`);
    closeShareModal();
  };

  const shareCertificateByEmail = async () => {
    if (!shareEmail.trim()) {
      alert("Please enter a valid email address.");
      return;
    }
    if (emailSending) return;
    setEmailSending(true);
    const cert = selectedCertificate;
    const emailToSend = shareEmail.trim();
    try {
      await axiosInstance.post("/learning/courses/share-certificate/", {
        certificate_id: cert?.id,
        share_type: "email",
        email: emailToSend,
      });
      alert(`Certificate sent to ${emailToSend} successfully!`);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Failed to send email. Please try again.");
    } finally {
      setEmailSending(false);
      closeShareModal();
    }
  };

  const exportResults = () => {
    const csvContent = [
      ["User Name", "Department", "Quiz Title", "Training Type", "Score", "Correct Answers", "Total Questions", "Time Taken (min)", "Completed At"],
      ...filteredResults.map(r => [
        r.user_name || "N/A", r.user_department || "N/A", r.content_title || "",
        r.content_type || "quiz", `${r.score}%`, r.correct_answers, r.total_questions,
        Math.round(r.time_taken / 60), new Date(r.completed_at).toLocaleString(),
      ]),
    ].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `quiz_results_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStats = () => {
    if (filteredResults.length === 0) return { totalAttempts: 0, averageScore: 0, passRate: 0, avgTime: { minutes: 0, seconds: 0 } };
    const total = filteredResults.length;
    const avgScore = Math.round(filteredResults.reduce((s, r) => s + r.score, 0) / total);
    const passRate = Math.round((filteredResults.filter(r => r.score >= (r.pass_percentage || 70)).length / total) * 100);
    const avgSec = Math.round(filteredResults.reduce((s, r) => s + r.time_taken, 0) / total);
    return { totalAttempts: total, averageScore: avgScore, passRate, avgTime: { minutes: Math.floor(avgSec / 60), seconds: avgSec % 60 } };
  };

  const stats = getStats();

  const activeFilters = [
    filters.user && `User: ${allUsers.find(u => String(u.id) === filters.user)?.name || "Selected"}`,
    filters.quiz && `Quiz: ${[...allQuizzes, ...allVideos].find(q => String(q.id) === filters.quiz)?.title || "Selected"}`,
    filters.trainingType && `Type: ${filters.trainingType}`,
    filters.department && `Department: ${filters.department}`,
    filters.minScore && `Min ${filters.minScore}%`,
    filters.maxScore && `Max ${filters.maxScore}%`,
    filters.dateFrom && `From ${filters.dateFrom}`,
    filters.dateTo && `To ${filters.dateTo}`,
  ].filter(Boolean);

  const filterSummary = activeFilters.length > 0 ? activeFilters.join(" • ") : "All results are shown. Expand filters to narrow down data.";

  if (loading) return <LearningLayout title="Admin Dashboard" description="Quiz results & certificate management"><div className="text-center py-10 text-gray-500">Loading...</div></LearningLayout>;

  return (
    <LearningLayout title="Admin Dashboard" description="Quiz results & certificate management">
      {/* Stats Cards - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
          <div className="flex-shrink-0 bg-blue-50 rounded-lg p-2"><Users className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs font-medium text-gray-500">Attempts</p><p className="text-xl font-bold text-gray-900">{stats.totalAttempts}</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
          <div className="flex-shrink-0 bg-green-50 rounded-lg p-2"><TrendingUp className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-xs font-medium text-gray-500">Avg Score</p><p className="text-xl font-bold text-gray-900">{stats.averageScore}%</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
          <div className="flex-shrink-0 bg-purple-50 rounded-lg p-2"><CheckCircle className="w-5 h-5 text-purple-600" /></div>
          <div><p className="text-xs font-medium text-gray-500">Pass Rate</p><p className="text-xl font-bold text-gray-900">{stats.passRate}%</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
          <div className="flex-shrink-0 bg-orange-50 rounded-lg p-2"><Clock className="w-5 h-5 text-orange-600" /></div>
          <div><p className="text-xs font-medium text-gray-500">Avg Time</p><p className="text-xl font-bold text-gray-900">{stats.avgTime.minutes}m {stats.avgTime.seconds}s</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow border-2 border-transparent hover:border-yellow-400" onClick={() => setShowCertificatesView(true)}>
          <div className="flex-shrink-0 bg-yellow-50 rounded-lg p-2"><Award className="w-5 h-5 text-yellow-600" /></div>
          <div><p className="text-xs font-medium text-gray-500">Certificates</p><p className="text-xl font-bold text-gray-900">{certificates.length}</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow border-2 border-transparent hover:border-indigo-400 col-span-2 md:col-span-1" onClick={() => setShowTrainingCompletionsView(true)}>
          <div className="flex-shrink-0 bg-indigo-50 rounded-lg p-2"><CheckCircle className="w-5 h-5 text-indigo-600" /></div>
          <div><p className="text-xs font-medium text-gray-500">Completed Training</p><p className="text-xl font-bold text-gray-900">{trainingCompletions.length}</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-500" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
              <p className="text-sm text-slate-500">Compact filter layout with quick access to search and advanced options.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setFiltersOpen(prev => !prev)} className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900">
              {filtersOpen ? "Collapse filters" : "Expand filters"}
            </button>
            <button onClick={clearFilters} className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900">Clear All</button>
            <button onClick={exportResults} className="inline-flex items-center justify-center rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" /> Export
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.5fr_auto] items-end mb-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search users or quizzes" className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm text-slate-600">{filterSummary}</div>
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">User</label>
              <select value={filters.user} onChange={(e) => handleFilterChange("user", e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="">All Users</option>
                {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Quiz / Video</label>
              <select value={filters.quiz} onChange={(e) => handleFilterChange("quiz", e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="">All Quizzes</option>
                {allQuizzes.map((q: any) => <option key={q.id} value={q.id}>{q.title}</option>)}
                {allVideos.map((v: any) => <option key={v.id} value={v.id}>{v.title} (Video)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Type</label>
              <select value={filters.trainingType} onChange={(e) => handleFilterChange("trainingType", e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="">All Types</option>
                <option value="Quiz">Quiz</option>
                <option value="Video training">Video training</option>
                <option value="Training">Training</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Department</label>
              <select value={filters.department} onChange={(e) => handleFilterChange("department", e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="">All Departments</option>
                {[...new Set(results.map((r: any) => r.user_department).filter(Boolean))].sort().map((dept: any) => <option key={dept} value={dept}>{dept}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 xl:col-span-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Score</label>
              <div className="flex gap-2">
                <input type="number" min="0" max="100" value={filters.minScore} onChange={(e) => handleFilterChange("minScore", e.target.value)} placeholder="Min" className="w-1/2 px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <input type="number" min="0" max="100" value={filters.maxScore} onChange={(e) => handleFilterChange("maxScore", e.target.value)} placeholder="Max" className="w-1/2 px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            </div>
            <div className="md:col-span-2 xl:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Completed</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange("dateFrom", e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange("dateTo", e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Quiz Results ({filteredResults.length})</h2>
        </div>
        {filteredResults.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No quiz results found</p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your filters or wait for users to complete quizzes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-700">
              <thead className="bg-slate-100">
                <tr>
                  {["User", "Department", "Quiz/Video", "Training Type", "Correct", "Score", "Result", "Time", "Completed", "Certificate", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-[0.06em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredResults.map((result, index) => {
                  const resultCert = certificates.find(c => c.result === result.id);
                  const isCertExpired = resultCert?.expires_at && new Date(resultCert.expires_at) < new Date();
                  const passed = result.score >= (result.pass_percentage || 70);
                  return (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600">{(result.user_name || "?").charAt(0).toUpperCase()}</div>
                          <div className="text-sm font-medium text-slate-900">{result.user_name || "Unknown"}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">{result.user_department || "N/A"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">{result.content_title || "N/A"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-1 text-[11px] font-semibold rounded-full ${result.content_type === "video" ? "bg-blue-100 text-blue-800" : result.content_type === "training" ? "bg-indigo-100 text-indigo-800" : "bg-purple-100 text-purple-800"}`}>
                          {result.content_type === "video" ? "Video training" : result.content_type === "training" ? "Training" : "Quiz"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">{result.correct_answers}/{result.total_questions}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{result.score}%</span>
                          <div className="w-16 rounded-full bg-slate-200 h-2">
                            <div className={`h-2 rounded-full ${result.score >= 70 ? "bg-emerald-500" : result.score >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${result.score}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {passed ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                          <span className={`text-sm font-semibold ${passed ? "text-emerald-600" : "text-rose-600"}`}>{passed ? "Pass" : "Fail"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">{Math.round(result.time_taken / 60)}m {result.time_taken % 60}s</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{new Date(result.completed_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {resultCert ? (
                          <div className="flex items-center gap-2">
                            <Award className={`w-5 h-5 ${isCertExpired ? "text-gray-400" : "text-yellow-500"}`} />
                            <span className={`text-xs font-semibold ${isCertExpired ? "text-gray-500" : "text-yellow-600"}`}>{isCertExpired ? "Expired" : "Issued"}</span>
                            <button onClick={() => handleViewCertificate(resultCert)} className="ml-1 text-blue-600 hover:text-blue-800 text-xs underline">View</button>
                          </div>
                        ) : passed ? (
                          <button onClick={() => handleIssueCertificate(result)} className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-1 text-green-700 text-xs font-semibold transition hover:bg-green-100">
                            <Award className="w-3 h-3" /> Issue
                          </button>
                        ) : <span className="text-xs text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                        <button onClick={() => handleViewDetails(result)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-slate-300 hover:text-slate-900">
                          <Eye className="w-4 h-4" /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Quiz Result Details</h2>
                <p className="text-blue-100 text-sm mt-1">{selectedResult.user_name} - {selectedResult.content_title}</p>
              </div>
              <button onClick={closeDetailModal} className="text-white hover:text-gray-200 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-600 mb-1">Score</p><p className="text-2xl font-bold text-blue-600">{selectedResult.score}%</p></div>
                <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-600 mb-1">Correct</p><p className="text-2xl font-bold text-green-600">{selectedResult.correct_answers}/{selectedResult.total_questions}</p></div>
                <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-600 mb-1">Time Taken</p><p className="text-2xl font-bold text-purple-600">{Math.round(selectedResult.time_taken / 60)}m {selectedResult.time_taken % 60}s</p></div>
                <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-600 mb-1">Completed</p><p className="text-lg font-bold text-gray-700">{new Date(selectedResult.completed_at).toLocaleString()}</p></div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Question-by-Question Breakdown</h3>
                {selectedResult.questions && selectedResult.questions.map((question: any, qIndex: number) => {
                  const userAnswer = selectedResult.answers && selectedResult.answers[qIndex];
                  const isCorrect = checkAnswerCorrect(question, userAnswer);
                  const qType = question.type || QUESTION_TYPES.MULTIPLE_CHOICE;
                  const isOptionType = qType === QUESTION_TYPES.MULTIPLE_CHOICE || qType === QUESTION_TYPES.TRUE_FALSE;
                  const options = question.displayOptions || question.options || [];
                  return (
                    <div key={qIndex} className={`border rounded-lg p-4 ${isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>{qIndex + 1}</span>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">{question.question}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">Type: {qType === QUESTION_TYPES.TRUE_FALSE ? "True/False" : qType === QUESTION_TYPES.FILL_IN_BLANK ? "Fill in the Blank" : qType === QUESTION_TYPES.NPS_SCALE ? "NPS Scale" : "Multiple Choice"}</p>
                          </div>
                        </div>
                        {isCorrect ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 ml-2" /> : <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 ml-2" />}
                      </div>
                      <div className="ml-11 space-y-2">
                        {isOptionType ? (
                          options.map((option: any, optIndex: number) => {
                            const isUserAnswer = Number(userAnswer) === optIndex;
                            const isCorrectAnswer = Number(question.correctAnswer) === optIndex;
                            let optionClass = "border-gray-200 bg-white";
                            let statusIcon = null;
                            if (isUserAnswer && isCorrectAnswer) { optionClass = "border-green-500 bg-green-100"; statusIcon = <CheckCircle className="w-4 h-4 text-green-600 ml-2" />; }
                            else if (isUserAnswer && !isCorrectAnswer) { optionClass = "border-red-500 bg-red-100"; statusIcon = <XCircle className="w-4 h-4 text-red-600 ml-2" />; }
                            else if (isCorrectAnswer && !isUserAnswer) { optionClass = "border-green-300 bg-green-50"; statusIcon = <CheckCircle className="w-4 h-4 text-green-400 ml-2" />; }
                            return (
                              <div key={optIndex} className={`flex items-center p-3 border rounded-lg ${optionClass}`}>
                                <span className="text-sm text-gray-700">{option}</span>
                                {statusIcon}
                              </div>
                            );
                          })
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center p-3 border border-gray-200 bg-white rounded-lg">
                              <span className="text-sm text-gray-600 mr-2">User answer:</span>
                              <span className="text-sm font-medium text-gray-900">{formatAnswerText(question, userAnswer)}</span>
                            </div>
                            <div className="flex items-center p-3 border border-green-200 bg-green-50 rounded-lg">
                              <span className="text-sm text-gray-600 mr-2">Correct answer:</span>
                              <span className="text-sm font-medium text-gray-900">{formatCorrectAnswerText(question)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Certificates View Modal */}
      {showCertificatesView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <Award className="w-6 h-6 text-yellow-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">All Certificates</h2>
                <span className="ml-3 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">{filteredCertificates.length} issued</span>
              </div>
              <div className="flex items-center gap-4">
                <input type="text" value={certSearchTerm} onChange={(e) => setCertSearchTerm(e.target.value)} placeholder="Search by certificate number, name, or training" className="rounded-lg border border-gray-200 px-4 py-2 text-sm w-72 focus:border-blue-500 focus:ring-blue-200 focus:outline-none" />
                <button onClick={() => setShowCertificatesView(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"><X className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {filteredCertificates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCertificates.map((cert) => {
                    const isExpired = cert.expires_at && new Date(cert.expires_at) < new Date();
                    return (
                      <div key={cert.id} className={`bg-gradient-to-br rounded-lg shadow-md overflow-hidden ${isExpired ? "from-gray-100 to-gray-200" : "from-yellow-50 to-amber-100 border-2 border-yellow-400"}`}>
                        <div className="p-5">
                          <div className="mb-2"><p className="font-mono text-sm font-semibold text-blue-900 bg-blue-50 px-2 py-1 rounded">{cert.certificate_number || cert.id}</p></div>
                          <div className="flex items-center mb-3">
                            <Award className={`w-8 h-8 mr-2 ${isExpired ? "text-gray-500" : "text-yellow-600"}`} />
                            <div>
                              <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{cert.quiz_title || "Unknown Training"}</h3>
                              <p className="text-xs text-gray-500">{cert.training_type}</p>
                            </div>
                          </div>
                          <div className="space-y-1 text-sm mb-4">
                            <div className="flex justify-between"><span className="text-gray-600">Recipient:</span><span className="font-medium">{cert.user_name}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Department:</span><span className="font-medium">{cert.user_department || "N/A"}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Score:</span><span className="font-semibold text-green-600">{cert.score}%</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Issued:</span><span className="font-medium">{new Date(cert.issued_at).toLocaleDateString()}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Status:</span><span className={`font-semibold ${isExpired ? "text-red-600" : "text-green-600"}`}>{isExpired ? "Expired" : "Valid"}</span></div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleViewCertificate(cert)} className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"><Eye className="w-4 h-4 mr-1" /> View</button>
                            <button onClick={() => handleShareCertificate(cert)} className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"><Share2 className="w-4 h-4 mr-1" /> Share</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{certSearchTerm ? "No Certificates Found" : "No Certificates Issued"}</h3>
                  <p className="text-gray-600">{certSearchTerm ? "Try adjusting your search criteria." : "No certificates have been issued yet."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Completed Training View Modal */}
      {showTrainingCompletionsView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <CheckCircle className="w-6 h-6 text-indigo-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">Completed Training</h2>
                <span className="ml-3 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">{filteredTrainingCompletions.length} completed</span>
              </div>
              <div className="flex items-center gap-4">
                <input type="text" value={trainingSearchTerm} onChange={(e) => setTrainingSearchTerm(e.target.value)} placeholder="Search by training or user name" className="rounded-lg border border-gray-200 px-4 py-2 text-sm w-72 focus:border-blue-500 focus:ring-blue-200 focus:outline-none" />
                <button onClick={() => setShowTrainingCompletionsView(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"><X className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {filteredTrainingCompletions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Training</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Score</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Time Taken</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Completed On</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTrainingCompletions.map((t: any) => {
                        const scorePct = t.total_questions > 0 ? Math.round((t.correct_answers / t.total_questions) * 100) : (t.score != null ? Math.round(t.score) : null);
                        const timeMin = Math.floor((t.time_taken || 0) / 60);
                        const timeSec = (t.time_taken || 0) % 60;
                        const passed = t.result_status === "passed";
                        return (
                          <tr key={t.attendance_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.training_title || "Untitled"}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{t.user_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{t.user_department || "N/A"}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{scorePct !== null ? `${scorePct}%` : "-"}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{t.time_taken ? `${timeMin}m ${timeSec}s` : "-"}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{t.check_out_time ? new Date(t.check_out_time).toLocaleString() : "-"}</td>
                            <td className="px-4 py-3 text-sm">
                              {t.result_status ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                  {passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {passed ? "Passed" : "Failed"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Attended</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{trainingSearchTerm ? "No Completed Training Found" : "No Training Completed Yet"}</h3>
                  <p className="text-gray-600">{trainingSearchTerm ? "Try adjusting your search criteria." : "Scheduled training completions will appear here once users finish them."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Certificate Detail Modal */}
      {selectedCertificate && !showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Certificate</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition" title="Print / Save PDF">
                  <Printer className="w-5 h-5" />
                </button>
                <button onClick={() => handleShareCertificate(selectedCertificate)} className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition" title="Share">
                  <Share2 className="w-5 h-5" />
                </button>
                <button onClick={closeCertificateView} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(92vh-80px)]">
              {/* Certificate Card - LD_Software style */}
              <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                {/* Outer Gold Border */}
                <div className="m-2 border-4 border-yellow-500 rounded-lg">
                  {/* Inner Blue Border */}
                  <div className="m-2 border-2 border-blue-900 rounded-lg">
                    <div className="p-6 md:p-10 flex flex-col items-center text-center">
                      {/* Organization Name */}
                      <h2 className="text-lg md:text-2xl font-bold text-blue-900 mb-1" style={{ fontFamily: "Georgia, serif" }}>
                        {selectedCertificate.organization_name || "VIBRO Learning, Training & Development"}
                      </h2>

                      {/* Decorative Line */}
                      <div className="w-32 md:w-48 h-1 bg-yellow-500 mb-4"></div>

                      {/* Certificate Title */}
                      <h1 className="text-xl md:text-3xl font-bold text-yellow-600 mb-6" style={{ fontFamily: "Georgia, serif" }}>
                        CERTIFICATE OF COMPLETION
                      </h1>

                      {/* Awarded to */}
                      <p className="text-sm md:text-base text-gray-600 italic mb-3" style={{ fontFamily: "Georgia, serif" }}>
                        This certificate is awarded to
                      </p>

                      {/* Recipient Name */}
                      <h3 className="text-xl md:text-3xl font-bold text-blue-900 mb-1" style={{ fontFamily: "Georgia, serif" }}>
                        {selectedCertificate.user_name || "Participant"}
                      </h3>

                      {/* Department */}
                      {selectedCertificate.user_department && (
                        <p className="text-xs md:text-sm text-gray-500 mb-3">
                          Department: {selectedCertificate.user_department}
                        </p>
                      )}

                      {/* Decorative Line */}
                      <div className="w-24 md:w-40 h-0.5 bg-yellow-500 mb-4"></div>

                      {/* For successfully completing */}
                      <p className="text-sm md:text-base text-gray-600 italic mb-3" style={{ fontFamily: "Georgia, serif" }}>
                        for successfully completing
                      </p>

                      {/* Training Title */}
                      <h4 className="text-base md:text-2xl font-bold text-blue-900 mb-2" style={{ fontFamily: "Georgia, serif" }}>
                        {selectedCertificate.quiz_title || "Training Program"}
                      </h4>

                      {/* Conducted by */}
                      <p className="text-xs md:text-sm text-gray-500 mb-4">
                        conducted by {selectedCertificate.organization_name || "VIBRO Learning, Training & Development"}
                      </p>

                      {/* Score Badge */}
                      <div className="flex items-center gap-2 bg-yellow-50 px-4 md:px-6 py-2 md:py-3 rounded-full mb-4">
                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-yellow-600" />
                        <span className="text-sm md:text-lg font-bold text-yellow-700">
                          Score: {selectedCertificate.score}% (Pass: {selectedCertificate.pass_percentage}%)
                        </span>
                      </div>

                      {/* Dates */}
                      <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6 text-gray-500 mb-4 text-xs md:text-sm">
                        <div>
                          <span>Issued on: </span>
                          <span className="font-semibold">
                            {new Date(selectedCertificate.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                          </span>
                        </div>
                        {selectedCertificate.expires_at && (
                          <div>
                            <span>Valid until: </span>
                            <span className="font-semibold">
                              {new Date(selectedCertificate.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Certified Professional Badge */}
                      <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold shadow-md mb-4">
                        <Award className="w-4 h-4" />
                        Certified Professional
                      </div>

                      {/* Certificate Number */}
                      <p className="text-xs md:text-sm text-yellow-700 font-semibold mb-1 break-all">
                        Certificate No: {selectedCertificate.certificate_number || selectedCertificate.id}
                      </p>

                      {/* Divider */}
                      <div className="w-full border-t border-gray-200 pt-4 mt-2">
                        {/* Digital Signature & QR Code */}
                        <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4">
                          {/* Digital Signature */}
                          <div className="flex flex-col items-center text-center">
                            <div className="text-blue-900 font-bold text-xs md:text-sm mb-1" style={{ fontFamily: "Georgia, serif" }}>
                              {selectedCertificate.organization_name || "VIBRO Learning, Training & Development"}
                            </div>
                            <div className="text-gray-500 text-xs">Authorized Signatory</div>
                            <div className="flex items-center gap-1 mt-2 text-blue-600">
                              <Shield className="w-4 h-4" />
                              <span className="text-xs font-semibold">Digitally Signed</span>
                            </div>
                          </div>

                          {/* QR Code */}
                          <div className="flex flex-col items-center">
                            <div className="bg-white p-2 border border-gray-300 rounded-lg shadow-sm">
                              <QRCodeSVG
                                value={`${window.location.origin}/learning/admin-dashboard?cert=${selectedCertificate.certificate_number || selectedCertificate.id}`}
                                size={80}
                                level="H"
                              />
                            </div>
                            <div className="text-xs text-gray-500 mt-2">Scan to verify</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expired Warning */}
              {selectedCertificate.expires_at && new Date(selectedCertificate.expires_at) < new Date() && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-700 text-sm">This certificate has expired and is no longer valid.</p>
                </div>
              )}

              {/* Share Button */}
              <div className="flex gap-3 mt-6">
                <button onClick={() => handleShareCertificate(selectedCertificate)} className="flex-1 flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition">
                  <Share2 className="w-5 h-5 mr-2" /> Share Certificate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Certificate Modal */}
      {showShareModal && selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center">
                <Share2 className="w-6 h-6 text-green-600 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">Share Certificate</h2>
              </div>
              <button onClick={closeShareModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              {/* Certificate Info Banner */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">Sharing: <strong>{selectedCertificate.quiz_title || "Unknown Training"}</strong></p>
                <p className="text-xs text-yellow-700 mt-1">Issued to: {selectedCertificate.user_name} ({selectedCertificate.score}%)</p>
              </div>

              {/* Tab Buttons */}
              <div className="flex gap-2 mb-4 border-b border-gray-200">
                {[
                  { key: "users", label: "Users", icon: Users },
                  { key: "groups", label: "Groups", icon: UsersRound },
                  { key: "locations", label: "Locations", icon: MapPin },
                  { key: "email", label: "Email", icon: Mail },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setShareTab(tab.key as any)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition ${
                        shareTab === tab.key
                          ? "border-green-600 text-green-700"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Search Box (for users, groups, locations) */}
              {shareTab !== "email" && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={shareSearch}
                    onChange={(e) => setShareSearch(e.target.value)}
                    placeholder={`Search ${shareTab}...`}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
              )}

              {/* Users Tab */}
              {shareTab === "users" && (
                <div className="overflow-y-auto max-h-64 border rounded-lg">
                  {allUsers
                    .filter((user: any) => {
                      const name = user.name || user.username || "";
                      return !shareSearch || name.toLowerCase().includes(shareSearch.toLowerCase());
                    })
                    .map((user: any) => (
                      <div key={user.id} className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-600 mr-3">
                            {(user.name || user.username || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name || user.username}</p>
                            <p className="text-xs text-gray-500">{user.department || user.email || "No department"}</p>
                          </div>
                        </div>
                        <button onClick={() => shareCertificateWithUser(String(user.id))} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition flex items-center gap-1">
                          <Send className="w-3.5 h-3.5" /> Share
                        </button>
                      </div>
                    ))}
                  {allUsers.filter((user: any) => {
                    const name = user.name || user.username || "";
                    return !shareSearch || name.toLowerCase().includes(shareSearch.toLowerCase());
                  }).length === 0 && <p className="text-center text-gray-500 py-4">No users found</p>}
                </div>
              )}

              {/* Groups Tab */}
              {shareTab === "groups" && (
                <div className="overflow-y-auto max-h-64 border rounded-lg">
                  {allGroups
                    .filter((group: any) => !shareSearch || group.name?.toLowerCase().includes(shareSearch.toLowerCase()))
                    .map((group: any) => (
                      <div key={group.id} className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                            <UsersRound className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{group.name}</p>
                            <p className="text-xs text-gray-500">Group</p>
                          </div>
                        </div>
                        <button onClick={() => shareCertificateWithGroup(String(group.id))} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition flex items-center gap-1">
                          <Send className="w-3.5 h-3.5" /> Share
                        </button>
                      </div>
                    ))}
                  {allGroups.filter((group: any) => !shareSearch || group.name?.toLowerCase().includes(shareSearch.toLowerCase())).length === 0 && <p className="text-center text-gray-500 py-4">No groups found</p>}
                </div>
              )}

              {/* Locations Tab */}
              {shareTab === "locations" && (
                <div className="overflow-y-auto max-h-64 border rounded-lg">
                  {allLocations
                    .filter((loc: any) => !shareSearch || loc.name?.toLowerCase().includes(shareSearch.toLowerCase()))
                    .map((loc: any) => (
                      <div key={loc.id} className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mr-3">
                            <MapPin className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{loc.name}</p>
                            <p className="text-xs text-gray-500">Location</p>
                          </div>
                        </div>
                        <button onClick={() => shareCertificateWithLocation(String(loc.id))} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition flex items-center gap-1">
                          <Send className="w-3.5 h-3.5" /> Share
                        </button>
                      </div>
                    ))}
                  {allLocations.filter((loc: any) => !shareSearch || loc.name?.toLowerCase().includes(shareSearch.toLowerCase())).length === 0 && <p className="text-center text-gray-500 py-4">No locations found</p>}
                </div>
              )}

              {/* Email Tab */}
              {shareTab === "email" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder="recipient@example.com"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        onKeyDown={(e) => { if (e.key === "Enter") shareCertificateByEmail(); }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={shareCertificateByEmail}
                    disabled={emailSending || !shareEmail.trim()}
                    className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {emailSending ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" /> Send Certificate
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </LearningLayout>
  );
}
