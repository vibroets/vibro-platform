"use client";

import React, { useState, useEffect } from "react";
import { Save, BookOpen, Video, FileText, Trash2, Edit2, Clock, AlertCircle } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import LearningLayout from "@/components/learning/LearningLayout";
import { useModuleAccess } from "@/hooks/useModuleAccess";

export default function DraftsPage() {
  const { isFullAccess, isViewOnly, isSuperAdmin } = useModuleAccess("learning_training");
  const canEdit = isFullAccess || isSuperAdmin;
  const [drafts, setDrafts] = useState<any[]>([]);

  useEffect(() => { fetchDrafts(); }, []);

  const fetchDrafts = async () => {
    try { const res = await axiosInstance.get("/learning/drafts/"); setDrafts(res.data); } catch (e) {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this draft?")) return;
    try { await axiosInstance.delete(`/learning/drafts/${id}/`); fetchDrafts(); } catch (e) { alert("Failed"); }
  };

  const getTypeIcon = (type: string) => {
    switch (type) { case "quiz": return BookOpen; case "video": return Video; case "training": return FileText; default: return Save; }
  };
  const getTypeLabel = (type: string) => {
    switch (type) { case "quiz": return "Quiz"; case "video": return "Video Training"; case "training": return "Training Asset"; default: return type; }
  };

  return (
    <LearningLayout title="Drafts" description="Saved quiz, video, and training drafts">
      {drafts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No drafts found</h3>
          <p className="text-sm text-gray-500">Save a quiz, video, or training as a draft from the L&T Module to see it here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {drafts.map((draft) => {
            const Icon = getTypeIcon(draft.draft_type);
            return (
              <div key={draft.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <div className={`p-3 rounded-lg mr-4 ${draft.draft_type === "quiz" ? "bg-blue-50 text-blue-600" : draft.draft_type === "video" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{getTypeLabel(draft.draft_type)}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500 flex items-center"><Clock className="w-3 h-3 mr-1" />{new Date(draft.saved_at).toLocaleString()}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mt-1">{draft.title}</h3>
                      {draft.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{draft.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {canEdit ? (
                      <>
                        <button className="flex items-center px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm">
                          <Edit2 className="w-4 h-4 mr-1.5" /> Continue
                        </button>
                        <button onClick={() => handleDelete(draft.id)} className="flex items-center px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm">
                          <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                        </button>
                      </>
                    ) : isViewOnly ? (
                      <span className="text-xs text-gray-500 italic">View only access</span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </LearningLayout>
  );
}
