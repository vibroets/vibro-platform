"use client";

import React, { useState, useEffect } from "react";
import { MapPin, Plus, Edit, Trash2, Building, Users, Save, X } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";

const EQUIPMENT_LIST = ["Projector", "Laptop", "Whiteboard", "Internet", "Lab Equipment", "Safety Equipment", "Video Conferencing", "Sound System", "Microphone", "Printer", "TV Screen", "AC"];
const AMENITY_LIST = ["Parking", "Cafeteria", "Restrooms", "Air Conditioning", "Wheelchair Access", "Storage", "Power Backup", "Catering Service"];

interface VenueForm {
  name: string; type: string; location: string; building: string; floor: string;
  capacity: number; equipment: string[]; amenities: string[]; hourly_rate: number;
  available: boolean; description: string;
}

const defaultVenueForm: VenueForm = { name: "", type: "training-room", location: "", building: "", floor: "", capacity: 20, equipment: [], amenities: [], hourly_rate: 0, available: true, description: "" };

export default function VenueManagementPage() {
  const [venues, setVenues] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<VenueForm>(defaultVenueForm);

  useEffect(() => { fetchVenues(); }, []);

  const fetchVenues = async () => {
    try { const res = await axiosInstance.get("/learning/venues/"); setVenues(res.data); } catch (e) {}
  };

  const openCreate = () => { setEditing(null); setForm(defaultVenueForm); setShowModal(true); };
  const openEdit = (v: any) => { setEditing(v); setForm({ name: v.name, type: v.type, location: v.location || "", building: v.building || "", floor: v.floor || "", capacity: v.capacity, equipment: v.equipment || [], amenities: v.amenities || [], hourly_rate: v.hourly_rate || 0, available: v.available, description: v.description || "" }); setShowModal(true); };

  const toggleEquipment = (item: string) => {
    setForm(prev => ({ ...prev, equipment: prev.equipment.includes(item) ? prev.equipment.filter(e => e !== item) : [...prev.equipment, item] }));
  };
  const toggleAmenity = (item: string) => {
    setForm(prev => ({ ...prev, amenities: prev.amenities.includes(item) ? prev.amenities.filter(a => a !== item) : [...prev.amenities, item] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) { await axiosInstance.patch(`/learning/venues/${editing.id}/`, form); }
      else { await axiosInstance.post("/learning/venues/", form); }
      setShowModal(false); fetchVenues();
    } catch (e: any) { alert("Failed: " + (e.response?.data?.detail || "Error")); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this venue?")) return;
    try { await axiosInstance.delete(`/learning/venues/${id}/`); fetchVenues(); } catch (e) { alert("Failed"); }
  };

  const typeLabels: Record<string, string> = { "training-room": "Training Room", "meeting-hall": "Meeting Hall", "conference-room": "Conference Room", "virtual": "Virtual" };

  return (
    <LearningLayout title="Venue Management" description="Manage training venues and facilities">
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#3A72EC] text-white rounded-lg hover:bg-[#2a5dbf] transition-colors text-sm font-medium">
          <Plus className="h-4 w-4" /> Add Venue
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Type</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Location</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Capacity</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {venues.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-500">No venues yet.</td></tr>
              ) : venues.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center"><MapPin className="h-4 w-4 text-rose-500" /></div>
                      <span className="font-medium text-gray-900">{v.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{typeLabels[v.type] || v.type}</span></td>
                  <td className="px-4 py-3 text-gray-600">{v.location || v.building ? `${v.location || ""}${v.building ? (v.location ? ", " : "") + v.building : ""}${v.floor ? `, Floor ${v.floor}` : ""}` : "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{v.capacity || "—"}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.available ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{v.available ? "Available" : "Unavailable"}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(v)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Edit"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(v.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
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
              <h2 className="text-xl font-semibold text-gray-900">{editing ? "Edit" : "Add"} Venue</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Venue Name *</label><input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter venue name" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"><option value="training-room">Training Room</option><option value="meeting-hall">Meeting Hall</option><option value="conference-room">Conference Room</option><option value="virtual">Virtual</option></select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Location</label><input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter location" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Building</label><input type="text" value={form.building} onChange={e => setForm({...form, building: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter building" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Floor</label><input type="text" value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter floor" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label><input type="number" min="1" value={form.capacity} onChange={e => setForm({...form, capacity: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="20" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate</label><input type="number" min="0" value={form.hourly_rate} onChange={e => setForm({...form, hourly_rate: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter description" /></div>
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.available} onChange={e => setForm({...form, available: e.target.checked})} className="rounded text-blue-600" /> Available</label>
              </div>
              {/* Equipment */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Equipment</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {EQUIPMENT_LIST.map(item => (
                    <label key={item} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" checked={form.equipment.includes(item)} onChange={() => toggleEquipment(item)} className="rounded text-blue-600" />
                      <span className="text-sm text-gray-700">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Amenities */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Amenities</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {AMENITY_LIST.map(item => (
                    <label key={item} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" checked={form.amenities.includes(item)} onChange={() => toggleAmenity(item)} className="rounded text-blue-600" />
                      <span className="text-sm text-gray-700">{item}</span>
                    </label>
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
