"use client";
import React, { useState, useEffect, useMemo } from "react";
import { CheckCircle, XCircle, Clock, FileText, Search, X, Plus, ChevronDown, ChevronRight, AlertCircle, Edit3, Trash2, UserCheck, Layers, DollarSign } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";
import { useModuleAccess } from "@/hooks/useModuleAccess";

const statusColors: Record<string, string> = { pending: "bg-amber-100 text-amber-700 border-amber-200", approved: "bg-green-100 text-green-700 border-green-200", rejected: "bg-red-100 text-red-700 border-red-200" };
const typeConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  "training-request": { label: "Training Request", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  "budget-request": { label: "Budget Request", icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
  "participant-request": { label: "Participant Request", icon: UserCheck, color: "text-purple-600", bg: "bg-purple-50" },
};

export default function ApprovalWorkflowPage() {
  const { isFullAccess, isViewOnly, isSuperAdmin } = useModuleAccess("learning_training");
  const canEdit = isFullAccess || isSuperAdmin;
  const [approvals, setApprovals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tab, setTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [departmentUsers, setDepartmentUsers] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState({
    title: "", type: "training-request", requested_by: "" as string | number, department: "", description: "",
    approval_chain: [] as { level: string; approver_id: string | number; approver_name: string }[],
    training_id: "", training_title: "", expected_outcome: "", amount: 0, justification: "",
  });

  useEffect(() => { fetchAll(); }, []);
  const showNotification = (type: "success" | "error" | "info", message: string) => { setNotification({ type, message }); setTimeout(() => setNotification(null), 4000); };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [ap, us, des] = await Promise.all([
        axiosInstance.get("/learning/approvals/"), axiosInstance.get("/learning/courses/users-list/"), axiosInstance.get("/learning/approvals/designations/"),
      ]);
      setApprovals(ap.data); setUsers(us.data); setDepartments(des.data);
    } catch (e) { showNotification("error", "Failed to load"); } finally { setLoading(false); }
  };

  const fetchUsersByDepartment = async (department: string) => {
    if (departmentUsers[department]) return;
    try { const res = await axiosInstance.get(`/learning/approvals/users-by-designation/?designation=${department}`); setDepartmentUsers(prev => ({ ...prev, [department]: res.data })); } catch (e) {}
  };

  const toggleExpand = (id: number) => { setExpandedItems(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const addChainLevel = () => { setForm(prev => ({ ...prev, approval_chain: [...prev.approval_chain, { level: "HR", approver_id: "", approver_name: "" }] })); };
  const updateChainLevel = (idx: number, field: string, value: string) => {
    setForm(prev => {
      const chain = [...prev.approval_chain]; chain[idx] = { ...chain[idx], [field]: value };
      if (field === "level") { chain[idx].approver_id = ""; chain[idx].approver_name = ""; fetchUsersByDepartment(value); }
      if (field === "approver_id") { const ul = departmentUsers[chain[idx].level] || []; const u = ul.find(uu => String(uu.id) === String(value)); chain[idx].approver_name = u ? u.name : ""; }
      return { ...prev, approval_chain: chain };
    });
  };
  const removeChainLevel = (idx: number) => { setForm(prev => ({ ...prev, approval_chain: prev.approval_chain.filter((_, i) => i !== idx) })); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.requested_by) { showNotification("error", "Title and requester required"); return; }
    if (form.approval_chain.length === 0) { showNotification("error", "Add at least one approval level"); return; }
    for (const c of form.approval_chain) { if (!c.approver_id) { showNotification("error", `Select approver for ${c.level}`); return; } }
    setSubmitting(true);
    try {
      await axiosInstance.post("/learning/approvals/", form);
      showNotification("success", "Approval request created!");
      setShowModal(false);
      setForm({ title: "", type: "training-request", requested_by: "", department: "", description: "", approval_chain: [], training_id: "", training_title: "", expected_outcome: "", amount: 0, justification: "" });
      fetchAll();
    } catch (e: any) { showNotification("error", "Failed: " + (e.response?.data?.detail || "Error")); } finally { setSubmitting(false); }
  };

  const handleApprove = async (id: number) => { try { await axiosInstance.patch(`/learning/approvals/${id}/approve/`); showNotification("success", "Approved!"); fetchAll(); } catch (e: any) { showNotification("error", e.response?.data?.detail || "Failed"); } };
  const handleReject = async (id: number) => { try { await axiosInstance.patch(`/learning/approvals/${id}/reject/`); showNotification("success", "Rejected!"); fetchAll(); } catch (e: any) { showNotification("error", e.response?.data?.detail || "Failed"); } };
  const handleEdit = (a: any) => { setEditTarget({ ...a }); setShowEditModal(true); };
  const handleEditSave = async () => { if (!editTarget) return; try { await axiosInstance.patch(`/learning/approvals/${editTarget.id}/edit/`, editTarget); showNotification("success", "Updated"); setShowEditModal(false); setEditTarget(null); fetchAll(); } catch (e) { showNotification("error", "Failed"); } };

  const filtered = useMemo(() => {
    let list = approvals;
    if (tab === "pending") list = list.filter(a => a.status === "pending");
    else if (tab === "approved") list = list.filter(a => a.status === "approved");
    else if (tab === "rejected") list = list.filter(a => a.status === "rejected");
    if (typeFilter !== "all") list = list.filter(a => a.type === typeFilter);
    if (searchQuery) { const q = searchQuery.toLowerCase(); list = list.filter(a => (a.title || "").toLowerCase().includes(q) || (a.department || "").toLowerCase().includes(q)); }
    return list;
  }, [approvals, tab, typeFilter, searchQuery]);

  const stats = useMemo(() => ({ total: approvals.length, pending: approvals.filter(a => a.status === "pending").length, approved: approvals.filter(a => a.status === "approved").length, rejected: approvals.filter(a => a.status === "rejected").length }), [approvals]);

  const renderProgressBar = (a: any) => {
    const chain = a.approval_chain || [];
    const levels = chain.length > 0 ? chain.map((c: any) => c.level) : (a.approval_levels || ["HR", "Management"]);
    const history = a.approval_history || [];
    const approvedLevels = history.filter((h: any) => h.action === "approved").map((h: any) => h.level);
    return (
      <div className="flex items-center gap-1 mt-2">
        {levels.map((level: string, idx: number) => {
          const isApproved = approvedLevels.includes(level);
          const isCurrent = a.status === "pending" && a.current_level === level;
          const isRejected = history.some((h: any) => h.level === level && h.action === "rejected");
          return (
            <React.Fragment key={idx}>
              <div className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${isApproved ? "bg-green-500" : isRejected ? "bg-red-500" : isCurrent ? "bg-amber-500 animate-pulse" : "bg-gray-300"}`}>{isApproved ? "✓" : isRejected ? "✕" : idx + 1}</div>
                <span className={`text-xs ${isCurrent ? "font-bold text-amber-600" : isApproved ? "text-green-600" : "text-gray-400"}`}>{level}</span>
              </div>
              {idx < levels.length - 1 && <div className={`h-0.5 w-6 ${isApproved ? "bg-green-400" : "bg-gray-200"}`} />}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderHistory = (a: any) => {
    const history = a.approval_history || [];
    if (!history.length) return <p className="text-xs text-gray-400 italic">No actions yet.</p>;
    return (
      <div className="space-y-1.5">
        {history.map((h: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {h.action === "approved" ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
            <span className="font-medium text-gray-700">{h.by}</span><span className="text-gray-400">{h.action} at {h.level}</span><span className="text-gray-400">{new Date(h.at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  };

  const statCards = [
    { label: "Total", value: stats.total, icon: Layers, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Approved", value: stats.approved, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <LearningLayout title="Approval Workflow" description="Multi-level approval chain management for training, budget, and participant requests">
      {notification && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${notification.type === "success" ? "bg-green-500 text-white" : notification.type === "error" ? "bg-red-500 text-white" : "bg-blue-500 text-white"}`}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{notification.message}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {statCards.map((s, i) => { const Icon = s.icon; return (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}><Icon className={`h-5 w-5 ${s.color}`} /></div>
            <div><p className="text-2xl font-bold text-gray-800">{s.value}</p><p className="text-xs text-gray-500">{s.label}</p></div>
          </div>); })}
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
          {[{ key: "all", label: "All" }, { key: "pending", label: "Pending" }, { key: "approved", label: "Approved" }, { key: "rejected", label: "Rejected" }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === t.key ? "bg-[#3A72EC] text-white" : "text-gray-600 hover:bg-gray-50"}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#3A72EC] outline-none" /></div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white"><option value="all">All Types</option><option value="training-request">Training</option><option value="budget-request">Budget</option><option value="participant-request">Participant</option></select>
          {canEdit ? (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#3A72EC] text-white rounded-lg hover:bg-[#2a5dbf] text-sm font-medium whitespace-nowrap"><Plus className="h-4 w-4" /> New Request</button>
          ) : isViewOnly ? (
            <span className="text-xs text-gray-500 italic">View only access</span>
          ) : null}
        </div>
      </div>
      {loading ? (
        <div className="text-center py-20 text-gray-400"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3A72EC] mb-2"></div><p>Loading...</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100"><Layers className="h-12 w-12 mx-auto mb-2 opacity-30" /><p>No approval requests found.</p></div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(a => {
            const isExp = expandedItems.has(a.id);
            const cfg = typeConfig[a.type] || typeConfig["training-request"];
            const Icon = cfg.icon;
            return (
              <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 cursor-pointer hover:bg-gray-50/50" onClick={() => toggleExpand(a.id)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-lg ${cfg.bg} flex items-center justify-center`}><Icon className={`h-5 w-5 ${cfg.color}`} /></div>
                      <div className="flex-1"><h3 className="font-bold text-gray-800">{a.title}</h3><p className="text-xs text-gray-500 mt-0.5">{cfg.label} • Requested by: {a.requested_by_name || a.requested_by}{a.department ? ` • ${a.department}` : ""}</p>{renderProgressBar(a)}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[a.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>{a.status}</span>
                      {isExp ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                    </div>
                  </div>
                </div>
                {isExp && (
                  <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/30">
                    {a.description && <div><p className="text-xs font-medium text-gray-500 mb-0.5">Description</p><p className="text-sm text-gray-700">{a.description}</p></div>}
                    {a.training_title && <div><p className="text-xs font-medium text-gray-500 mb-0.5">Training</p><p className="text-sm text-gray-700">{a.training_title}</p></div>}
                    {a.justification && <div><p className="text-xs font-medium text-gray-500 mb-0.5">Justification</p><p className="text-sm text-gray-700">{a.justification}</p></div>}
                    {Number(a.amount) > 0 && <div><p className="text-xs font-medium text-gray-500 mb-0.5">Amount</p><p className="text-sm text-gray-700">${a.amount}</p></div>}
                    <div><p className="text-xs font-medium text-gray-500 mb-1">Approval Chain</p><div className="flex flex-wrap gap-2">{(a.approval_chain || []).map((c: any, i: number) => { const hist = (a.approval_history || []).find((h: any) => h.level === c.level); const approver = hist ? hist.by : (c.approver_name || ""); const isApproved = hist && hist.action === "approved"; const isRejected = hist && hist.action === "rejected"; return (<div key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${isApproved ? "bg-green-50 border-green-200" : isRejected ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}><span className="font-medium text-gray-700">{c.level}</span><span className="text-gray-400">→</span>{isApproved ? <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {approver}</span> : isRejected ? <span className="text-red-600 font-medium flex items-center gap-1"><XCircle className="h-3 w-3" /> {approver}</span> : <span className="text-gray-600">{approver || "Unassigned"}</span>}</div>); })}</div></div>
                    <div><p className="text-xs font-medium text-gray-500 mb-1">History</p>{renderHistory(a)}</div>
                    {a.status === "pending" && a.can_approve && canEdit && (<div className="flex gap-2 pt-2 border-t border-gray-100"><button onClick={() => handleApprove(a.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"><CheckCircle className="h-4 w-4" /> Approve</button><button onClick={() => handleReject(a.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"><XCircle className="h-4 w-4" /> Reject</button></div>)}
                    {a.status === "pending" && !a.can_approve && (<div className="pt-2 border-t border-gray-100"><div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg"><Clock className="h-4 w-4" /> <span className="font-medium">Pending with {a.pending_with_department || a.current_level}</span>{a.pending_with_users && a.pending_with_users.length > 0 && <span className="text-gray-500">— {a.pending_with_users.join(", ")}</span>}{a.pending_with_users && a.pending_with_users.length === 0 && <span className="text-red-500">— No users found in this department</span>}</div></div>)}
                    {canEdit && <button onClick={() => handleEdit(a)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#3A72EC]"><Edit3 className="h-3.5 w-3.5" /> Edit</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* New Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-800">New Approval Request</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A72EC] outline-none" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select className="w-full p-2.5 border border-gray-200 rounded-lg outline-none" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="training-request">Training Request</option><option value="budget-request">Budget Request</option><option value="participant-request">Participant Request</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Requested By *</label>
                  <select className="w-full p-2.5 border border-gray-200 rounded-lg outline-none" value={form.requested_by} onChange={e => setForm({ ...form, requested_by: e.target.value })} required>
                    <option value="">Select User...</option>{users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Department</label><input className="w-full p-2.5 border border-gray-200 rounded-lg outline-none" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea className="w-full p-2.5 border border-gray-200 rounded-lg outline-none" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              {form.type === "budget-request" && <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount</label><input type="number" className="w-full p-2.5 border border-gray-200 rounded-lg outline-none" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Justification</label><textarea className="w-full p-2.5 border border-gray-200 rounded-lg outline-none" rows={2} value={form.justification} onChange={e => setForm({ ...form, justification: e.target.value })} /></div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium text-gray-700">Approval Chain *</label><button type="button" onClick={addChainLevel} className="flex items-center gap-1 text-xs text-[#3A72EC] hover:underline"><Plus className="h-3 w-3" /> Add Level</button></div>
                <div className="space-y-2">
                  {form.approval_chain.length === 0 && <p className="text-xs text-gray-400 italic">Add at least one approval level.</p>}
                  {form.approval_chain.map((c, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <div className="w-6 h-6 rounded-full bg-[#3A72EC] text-white flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                      <select className="p-2 border border-gray-200 rounded-lg text-sm outline-none" value={c.level} onChange={e => updateChainLevel(idx, "level", e.target.value)}>{departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select>
                      <select className="flex-1 p-2 border border-gray-200 rounded-lg text-sm outline-none" value={c.approver_id} onChange={e => updateChainLevel(idx, "approver_id", e.target.value)}><option value="">Select Approver...</option>{(departmentUsers[c.level] || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                      <button type="button" onClick={() => removeChainLevel(idx)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 bg-[#3A72EC] text-white rounded-lg hover:bg-[#2a5dbf] disabled:opacity-50">{submitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 white"></div> : <Plus className="h-4 w-4" />} Create Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {showEditModal && editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">Edit Approval Request</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Title</label><input className="w-full p-2.5 border border-gray-200 rounded-lg outline-none" value={editTarget.title || ""} onChange={e => setEditTarget({ ...editTarget, title: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Department</label><input className="w-full p-2.5 border border-gray-200 rounded-lg outline-none" value={editTarget.department || ""} onChange={e => setEditTarget({ ...editTarget, department: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea className="w-full p-2.5 border border-gray-200 rounded-lg outline-none" rows={2} value={editTarget.description || ""} onChange={e => setEditTarget({ ...editTarget, description: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className="w-full p-2.5 border border-gray-200 rounded-lg outline-none" value={editTarget.status || "pending"} onChange={e => setEditTarget({ ...editTarget, status: e.target.value })}>
                  <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleEditSave} className="px-4 py-2 bg-[#3A72EC] text-white rounded-lg hover:bg-[#2a5dbf]">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </LearningLayout>
  );
}
