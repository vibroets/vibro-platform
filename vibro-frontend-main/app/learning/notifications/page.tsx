"use client";

import React, { useState, useEffect } from "react";
import { Bell, Plus, Edit, Trash2, Mail, MessageSquare, Smartphone, Save, X, Send, ToggleLeft, ToggleRight } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";
import { useModuleAccess } from "@/hooks/useModuleAccess";

const NOTIFICATION_TYPES = [
  { value: "training-created", label: "Training Created" },
  { value: "training-modified", label: "Training Modified" },
  { value: "training-cancelled", label: "Training Cancelled" },
  { value: "training-reminder", label: "Training Reminder" },
  { value: "venue-changed", label: "Venue Changed" },
  { value: "trainer-changed", label: "Trainer Changed" },
  { value: "enrollment-approved", label: "Enrollment Approved" },
  { value: "enrollment-rejected", label: "Enrollment Rejected" },
  { value: "enrollment-request", label: "Enrollment Request" },
  { value: "quiz-assigned", label: "Quiz Assigned" },
  { value: "quiz-completed", label: "Quiz Completed" },
  { value: "quiz-failed", label: "Quiz Failed" },
  { value: "certificate-issued", label: "Certificate Issued" },
  { value: "video-assigned", label: "Video Assigned" },
  { value: "video-completed", label: "Video Completed" },
  { value: "training-completed", label: "Training Completed" },
  { value: "approval-request", label: "Approval Request" },
  { value: "approval-approved", label: "Approval Approved" },
  { value: "approval-rejected", label: "Approval Rejected" },
];

const TRIGGER_OPTIONS = [
  { value: "immediate", label: "Immediate" },
  { value: "30-days", label: "30 Days Before" },
  { value: "15-days", label: "15 Days Before" },
  { value: "7-days", label: "7 Days Before" },
  { value: "3-days", label: "3 Days Before" },
  { value: "1-day", label: "1 Day Before" },
  { value: "1-hour", label: "1 Hour Before" },
  { value: "15-minutes", label: "15 Minutes Before" },
  { value: "on-completion", label: "On Completion" },
  { value: "on-failure", label: "On Failure" },
];

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: Smartphone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "push", label: "Push Notification", icon: Bell },
  { value: "in-app", label: "In-App", icon: Send },
];

interface NotificationForm {
  title: string; type: string; trigger: string; channels: string[];
  template: string; enabled: boolean;
}

const defaultNotifForm: NotificationForm = { title: "", type: "training-created", trigger: "immediate", channels: ["email"], template: "", enabled: true };

export default function NotificationsPage() {
  const { isFullAccess, isViewOnly, isSuperAdmin } = useModuleAccess("learning_training");
  const canEdit = isFullAccess || isSuperAdmin;
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<NotificationForm>(defaultNotifForm);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try { const res = await axiosInstance.get("/learning/notifications/"); setNotifications(res.data); } catch (e) {}
  };

  const openCreate = () => { setEditing(null); setForm(defaultNotifForm); setShowModal(true); };
  const openEdit = (n: any) => { setEditing(n); setForm({ title: n.title, type: n.type, trigger: n.trigger, channels: n.channels || ["email"], template: n.template || "", enabled: n.enabled }); setShowModal(true); };

  const handleToggleEnabled = async (n: any) => {
    try { await axiosInstance.patch(`/learning/notifications/${n.id}/`, { enabled: !n.enabled }); fetchNotifications(); } catch (e) { alert("Failed"); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) { await axiosInstance.patch(`/learning/notifications/${editing.id}/`, form); }
      else { await axiosInstance.post("/learning/notifications/", form); }
      setShowModal(false); fetchNotifications();
    } catch (e: any) { alert("Failed: " + (e.response?.data?.detail || "Error")); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this notification?")) return;
    try { await axiosInstance.delete(`/learning/notifications/${id}/`); fetchNotifications(); } catch (e) { alert("Failed"); }
  };

  const toggleChannel = (ch: string) => {
    setForm({...form, channels: form.channels.includes(ch) ? form.channels.filter(c => c !== ch) : [...form.channels, ch]});
  };

  const typeLabels: Record<string, string> = Object.fromEntries(NOTIFICATION_TYPES.map(t => [t.value, t.label]));
  const triggerLabels: Record<string, string> = Object.fromEntries(TRIGGER_OPTIONS.map(t => [t.value, t.label]));
  const channelIcons: Record<string, any> = { email: Mail, sms: Smartphone, whatsapp: MessageSquare, push: Bell, "in-app": Send };

  return (
    <LearningLayout title="Notifications" description="Manage notification templates and triggers">
      <div className="flex justify-end mb-4">
        {canEdit ? (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#3A72EC] text-white rounded-lg hover:bg-[#2a5dbf] transition-colors text-sm font-medium">
            <Plus className="h-4 w-4" /> Add Notification
          </button>
        ) : isViewOnly ? (
          <span className="text-xs text-gray-500 italic self-center">View only access</span>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Title</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Type</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Trigger</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Channels</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-500">No notifications configured.</td></tr>
              ) : notifications.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><Bell className="h-4 w-4 text-amber-500" /></div>
                      <div>
                        <div className="font-medium text-gray-900">{n.title}</div>
                        {n.template && <div className="text-xs text-gray-500 truncate max-w-xs mt-0.5">{n.template}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{typeLabels[n.type] || n.type}</span></td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{triggerLabels[n.trigger] || n.trigger}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {(n.channels || []).map((ch: string) => {
                        const Icon = channelIcons[ch] || Bell;
                        return <span key={ch} className="flex items-center gap-0.5 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full text-gray-600"><Icon className="h-3 w-3" /> {ch}</span>;
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <button onClick={() => handleToggleEnabled(n)} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${n.enabled ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{n.enabled ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />} {n.enabled ? "Enabled" : "Disabled"}</button>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${n.enabled ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{n.enabled ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />} {n.enabled ? "Enabled" : "Disabled"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {canEdit && (
                        <>
                          <button onClick={() => openEdit(n)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Edit"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(n.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white rounded-t-lg">
              <h2 className="text-xl font-semibold text-gray-900">{editing ? "Edit" : "Add"} Notification</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Notification Details</h3>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input type="text" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter notification title" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">{NOTIFICATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Trigger Timing</label><select value={form.trigger} onChange={e => setForm({...form, trigger: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">{TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                </div>
              </div>
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Channels</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {CHANNELS.map(ch => { const Icon = ch.icon; return (
                    <label key={ch.value} className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${form.channels.includes(ch.value) ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50"}`}>
                      <input type="checkbox" checked={form.channels.includes(ch.value)} onChange={() => toggleChannel(ch.value)} className="rounded text-blue-600" />
                      <Icon className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-700">{ch.label}</span>
                    </label>
                  ); })}
                </div>
              </div>
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Template</h3>
                <textarea value={form.template} onChange={e => setForm({...form, template: e.target.value})} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm" placeholder="Enter notification template. Use {{title}}, {{date}}, {{user}}, {{venue}}, {{trainer}} as placeholders." />
                <p className="text-xs text-gray-500 mt-1">Available placeholders: {`{{title}}, {{date}}, {{user}}, {{venue}}, {{trainer}}, {{department}}`}</p>
              </div>
              <div className="border-t pt-6">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer"><input type="checkbox" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} className="rounded text-blue-600 w-4 h-4" /> Enable this notification</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Save className="w-4 h-4" /> {editing ? "Update" : "Add"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </LearningLayout>
  );
}
