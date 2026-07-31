"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Users, CheckCircle, TrendingUp, Award, MapPin } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";

export default function TrainingAnalyticsPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    axiosInstance.get("/learning/analytics/").then((res) => setStats(res.data)).catch(() => {});
  }, []);

  if (!stats) return <LearningLayout title="Training Analytics" description="Analytics overview"><div className="text-center py-10 text-gray-500">Loading...</div></LearningLayout>;

  const cards = [
    { label: "Total Trainings", value: stats.total_trainings, icon: Calendar, color: "bg-blue-500" },
    { label: "Total Trainers", value: stats.total_trainers, icon: Users, color: "bg-green-500" },
    { label: "Total Venues", value: stats.total_venues, icon: MapPin, color: "bg-rose-500" },
    { label: "Total Quizzes", value: stats.total_quizzes, icon: CheckCircle, color: "bg-purple-500" },
    { label: "Total Videos", value: stats.total_videos, icon: TrendingUp, color: "bg-indigo-500" },
    { label: "Enrollments", value: stats.total_enrollments, icon: Award, color: "bg-amber-500" },
    { label: "Attendance Rate", value: `${stats.attendance_rate}%`, icon: TrendingUp, color: "bg-teal-500" },
    { label: "Total Attendances", value: stats.total_attendances, icon: CheckCircle, color: "bg-cyan-500" },
  ];

  return (
    <LearningLayout title="Training Analytics" description="Comprehensive analytics dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-4`}>
              <card.icon className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm text-gray-500 font-medium">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Trainings</h2>
        {stats.recent_trainings?.length === 0 ? (
          <p className="text-gray-500 text-sm">No trainings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Trainer</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_trainings?.map((t: any) => (
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
    </LearningLayout>
  );
}
