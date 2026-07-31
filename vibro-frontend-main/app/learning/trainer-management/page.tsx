"use client";

import React, { useState, useEffect } from "react";
import { UserCog, Plus, Edit, Trash2, Mail, Phone, Clock, Save, X } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";

interface AvailabilitySlot { available: boolean; startTime: string; endTime: string; }
type AvailabilitySchedule = Record<string, AvailabilitySlot>;

const defaultAvailability: AvailabilitySchedule = {
  monday: { available: true, startTime: "09:00", endTime: "17:00" },
  tuesday: { available: true, startTime: "09:00", endTime: "17:00" },
  wednesday: { available: true, startTime: "09:00", endTime: "17:00" },
  thursday: { available: true, startTime: "09:00", endTime: "17:00" },
  friday: { available: true, startTime: "09:00", endTime: "17:00" },
  saturday: { available: false, startTime: "", endTime: "" },
  sunday: { available: false, startTime: "", endTime: "" },
};

interface TrainerForm {
  name: string; email: string; phone: string; type: string; department: string;
  expertise: string; hourly_rate: number; bio: string;
}

const defaultTrainerForm: TrainerForm = { name: "", email: "", phone: "", type: "internal", department: "", expertise: "", hourly_rate: 0, bio: "" };

export default function TrainerManagementPage() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<TrainerForm>(defaultTrainerForm);
  const [availability, setAvailability] = useState<AvailabilitySchedule>(defaultAvailability);

  useEffect(() => { fetchTrainers(); }, []);

  const fetchTrainers = async () => {
    try { const res = await axiosInstance.get("/learning/trainers/"); setTrainers(res.data); } catch (e) {}
  };

  const openCreate = () => { setEditing(null); setForm(defaultTrainerForm); setAvailability(defaultAvailability); setShowModal(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ name: t.name, email: t.email || "", phone: t.phone || "", type: t.type, department: t.department || "", expertise: t.expertise || "", hourly_rate: t.hourly_rate || 0, bio: t.bio || "" }); setAvailability(t.availability || defaultAvailability); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, availability };
    try {
      if (editing) { await axiosInstance.patch(`/learning/trainers/${editing.id}/`, payload); }
      else { await axiosInstance.post("/learning/trainers/", payload); }
      setShowModal(false); fetchTrainers();
    } catch (e: any) { alert("Failed: " + (e.response?.data?.detail || "Error")); }
  };

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  const updateAvailability = (day: string, field: keyof AvailabilitySlot, value: any) => {
    setAvailability(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this trainer?")) return;
    try { await axiosInstance.delete(`/learning/trainers/${id}/`); fetchTrainers(); } catch (e) { alert("Failed"); }
  };

  const typeColors: Record<string, string> = { internal: "bg-blue-100 text-blue-700", external: "bg-green-100 text-green-700", "co-trainer": "bg-amber-100 text-amber-700", "guest-speaker": "bg-purple-100 text-purple-700" };

  return (
    <LearningLayout title="Trainer Management" description="Manage internal and external trainers">
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#3A72EC] text-white rounded-lg hover:bg-[#2a5dbf] transition-colors text-sm font-medium">
          <Plus className="h-4 w-4" /> Add Trainer
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Type</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Email</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Phone</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Department</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trainers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-500">No trainers yet.</td></tr>
              ) : trainers.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#3A72EC]/10 flex items-center justify-center"><UserCog className="h-4 w-4 text-[#3A72EC]" /></div>
                      <div>
                        <span className="font-medium text-gray-900">{t.name}</span>
                        {t.expertise && <div className="text-xs text-gray-500 truncate max-w-xs">{t.expertise}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[t.type] || "bg-gray-100 text-gray-700"}`}>{t.type}</span></td>
                  <td className="px-4 py-3 text-gray-600">{t.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.phone || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{t.department || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(t)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Edit"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
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
              <h2 className="text-xl font-semibold text-gray-900">{editing ? "Edit" : "Add"} Trainer</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter name" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter email" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter phone" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"><option value="internal">Internal</option><option value="external">External</option><option value="co-trainer">Co-Trainer</option><option value="guest-speaker">Guest Speaker</option></select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Department</label><input type="text" value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter department" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Expertise</label><input type="text" value={form.expertise} onChange={e => setForm({...form, expertise: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter expertise" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate</label><input type="number" min="0" value={form.hourly_rate} onChange={e => setForm({...form, hourly_rate: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Bio</label><textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter bio" /></div>
              </div>
              {/* Availability Schedule */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4"><Clock className="w-5 h-5" /> Availability Schedule</h3>
                <div className="space-y-2">
                  {days.map(day => (
                    <div key={day} className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg">
                      <label className="flex items-center gap-2 w-28 capitalize">
                        <input type="checkbox" checked={availability[day].available} onChange={e => updateAvailability(day, "available", e.target.checked)} className="rounded text-blue-600" />
                        {day}
                      </label>
                      {availability[day].available && (<>
                        <input type="time" value={availability[day].startTime} onChange={e => updateAvailability(day, "startTime", e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm" />
                        <span className="text-gray-500 text-sm">to</span>
                        <input type="time" value={availability[day].endTime} onChange={e => updateAvailability(day, "endTime", e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm" />
                      </>)}
                      {!availability[day].available && <span className="text-sm text-gray-400">Unavailable</span>}
                    </div>
                  ))}
                </div>
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
