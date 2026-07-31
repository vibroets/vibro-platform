"use client";

import React, { useState, useEffect } from "react";
import { Users, BookOpen, Video, Calendar, TrendingUp, Award, MapPin, ClipboardList } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess";

export default function Page() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("learning_training", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [stats, setStats] = useState({
    total_trainings: 0,
    total_trainers: 0,
    total_venues: 0,
    total_quizzes: 0,
    total_videos: 0,
    total_enrollments: 0,
    total_attendances: 0,
    attendance_rate: 0,
    recent_trainings: [] as any[],
  });

  if (!hydrated || !hasRequiredAccess) return null;

  useEffect(() => {
    axiosInstance.get("/learning/analytics/").then((res) => setStats(res.data)).catch(() => {});
  }, []);

  const cards = [
    { label: "Trainings", value: stats.total_trainings, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Trainers", value: stats.total_trainers, icon: Users, color: "text-green-600", bg: "bg-green-50" },
    { label: "Venues", value: stats.total_venues, icon: MapPin, color: "text-rose-600", bg: "bg-rose-50" },
    { label: "Quizzes", value: stats.total_quizzes, icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Videos", value: stats.total_videos, icon: Video, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Enrollments", value: stats.total_enrollments, icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Att. Rate", value: `${stats.attendance_rate}%`, icon: TrendingUp, color: "text-teal-600", bg: "bg-teal-50" },
    { label: "Certs", value: stats.total_attendances, icon: Award, color: "text-cyan-600", bg: "bg-cyan-50" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} title="L&D Dashboard" description="Learning & Training overview" />
        <div className="p-4 md:p-6">
          {/* Stats - Single Line Compact Cards */}
          <div className="flex flex-nowrap gap-2 mb-6 overflow-x-auto pb-1">
            {cards.map((card) => (
              <div key={card.label} className="bg-white rounded-lg shadow-sm border border-gray-100 px-3 py-2 flex items-center gap-2 flex-shrink-0 hover:shadow-md transition-shadow">
                <div className={`flex-shrink-0 ${card.bg} rounded-lg p-1.5`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-gray-900">{card.value}</span>
                  <span className="text-[11px] text-gray-500 whitespace-nowrap">{card.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-base font-bold text-gray-900 mb-3">Recent Trainings</h2>
            {stats.recent_trainings.length === 0 ? (
              <p className="text-gray-500 text-sm">No trainings scheduled yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Start Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Trainer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_trainings.map((t: any) => (
                      <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900 font-medium">{t.title}</td>
                        <td className="py-3 px-4 text-gray-600">{t.start_date}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            t.status === "approved" ? "bg-green-100 text-green-700" :
                            t.status === "pending" ? "bg-amber-100 text-amber-700" :
                            t.status === "completed" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>{t.status}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{t.trainer_name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}