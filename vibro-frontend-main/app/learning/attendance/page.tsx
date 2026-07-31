"use client";

import React, { useState, useEffect } from "react";
import { Clock, CheckCircle, XCircle, UserCheck, ChevronDown, ChevronUp, MapPin, QrCode, Smartphone, Calendar, Filter, Download } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";

const CHECK_IN_METHODS = ["manual", "qr-code", "biometric", "mobile-app", "selfie"];
const METHOD_ICONS: Record<string, any> = { manual: UserCheck, "qr-code": QrCode, biometric: CheckCircle, "mobile-app": Smartphone, selfie: UserCheck };

export default function AttendancePage() {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [trainingFilter, setTrainingFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => { fetchAttendances(); fetchTrainings(); }, []);

  const fetchAttendances = async () => {
    try { const res = await axiosInstance.get("/learning/attendances/"); setAttendances(res.data); } catch (e) {}
  };

  const fetchTrainings = async () => {
    try { const res = await axiosInstance.get("/learning/training-schedules/"); setTrainings(res.data); } catch (e) {}
  };

  const handleCheckIn = async (id: number) => {
    try { await axiosInstance.patch(`/learning/attendances/${id}/check_in/`); fetchAttendances(); } catch (e) { alert("Failed"); }
  };
  const handleCheckOut = async (id: number) => {
    try { await axiosInstance.patch(`/learning/attendances/${id}/check_out/`); fetchAttendances(); } catch (e) { alert("Failed"); }
  };

  const filtered = attendances.filter(a => {
    if (filter !== "all" && a.status !== filter) return false;
    if (trainingFilter !== "all" && String(a.training_id) !== trainingFilter) return false;
    if (methodFilter !== "all" && a.check_in_method !== methodFilter) return false;
    return true;
  });
  const statusColors: Record<string, string> = { present: "bg-green-100 text-green-700", absent: "bg-red-100 text-red-700", late: "bg-amber-100 text-amber-700", pending: "bg-gray-100 text-gray-700" };

  return (
    <LearningLayout title="Attendance" description="Track training attendance">
      {/* Status filter tabs */}
      <div className="flex gap-2 mb-3">
        {["all", "present", "absent", "late", "pending"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? "bg-[#3A72EC] text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>{f}</button>
        ))}
      </div>

      {/* Training & method filters */}
      <div className="flex gap-3 mb-4 items-center">
        <Filter className="h-4 w-4 text-gray-400" />
        <select value={trainingFilter} onChange={e => setTrainingFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
          <option value="all">All Trainings</option>
          {trainings.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
          <option value="all">All Methods</option>
          {CHECK_IN_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Training</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Participant</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Check In</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Check Out</th>
                <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Method</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-500">No attendance records.</td></tr>
              ) : filtered.map((att) => (
                <React.Fragment key={att.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><UserCheck className="h-4 w-4 text-blue-500" /></div>
                        <span className="font-medium text-gray-900">{att.training_title || `Training ${att.training_id}`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{att.user_name || `User ${att.user}`}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[att.status] || "bg-gray-100 text-gray-700"}`}>{att.status}</span></td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{att.check_in_time ? new Date(att.check_in_time).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{att.check_out_time ? new Date(att.check_out_time).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize whitespace-nowrap">{att.check_in_method || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {att.status === "pending" && (
                          <button onClick={() => handleCheckIn(att.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-xs font-medium"><CheckCircle className="h-3.5 w-3.5" /> Check In</button>
                        )}
                        {att.check_in_time && !att.check_out_time && (
                          <button onClick={() => handleCheckOut(att.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"><Clock className="h-3.5 w-3.5" /> Check Out</button>
                        )}
                        <button onClick={() => setExpanded({...expanded, [att.id]: !expanded[att.id]})} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg" title="Details">
                          {expanded[att.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded[att.id] && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div><span className="text-gray-500">Check-in Method:</span> <span className="text-gray-800 capitalize">{att.check_in_method || "—"}</span></div>
                          <div><span className="text-gray-500">Check-out Method:</span> <span className="text-gray-800 capitalize">{att.check_out_method || "—"}</span></div>
                          <div><span className="text-gray-500">Created:</span> <span className="text-gray-800">{new Date(att.created_on).toLocaleString()}</span></div>
                          {att.location && <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-gray-400" /><span className="text-gray-500">Location:</span> <span className="text-gray-800">{att.location}</span></div>}
                          {att.notes && <div className="col-span-2"><span className="text-gray-500">Notes:</span> <span className="text-gray-800">{att.notes}</span></div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </LearningLayout>
  );
}
