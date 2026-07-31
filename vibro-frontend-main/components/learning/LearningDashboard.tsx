"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/header"; 
import { Sidebar } from "@/components/sidebar";
import axiosInstance from "@/utils/axiosInstance";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess";

// --- REUSABLE MULTI-SELECT COMPONENT (Same as CourseUploader) ---
interface MultiSelectProps {
  label: string;
  options: any[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  getLabel: (item: any) => string;
  placeholder?: string;
}

const MultiSelectDropdown = ({ label, options, selectedIds, onChange, getLabel, placeholder = "Select..." }: MultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => 
    getLabel(opt).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(sid => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-3 border rounded bg-white cursor-pointer flex justify-between items-center ${isOpen ? 'ring-2 ring-[#3A72EC] border-transparent' : 'border-gray-300'}`}
      >
        <span className={selectedIds.length > 0 ? "text-gray-900" : "text-gray-400"}>
          {selectedIds.length > 0 ? `${selectedIds.length} Selected` : placeholder}
        </span>
        <span className="text-gray-500 text-xs">▼</span>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input 
              autoFocus
              type="text"
              placeholder="Search..."
              className="w-full p-2 text-sm bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-[#3A72EC] text-gray-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-gray-400 text-center">No results found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedIds.includes(opt.id);
                return (
                  <div 
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className={`flex items-center p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-[#3A72EC]/5' : 'hover:bg-gray-50'}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 ${isSelected ? 'bg-[#3A72EC] border-[#3A72EC]' : 'border-gray-300 bg-white'}`}>
                      {isSelected && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <span className={`text-sm ${isSelected ? 'text-[#3A72EC] font-medium' : 'text-gray-700'}`}>
                      {getLabel(opt)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---
interface Course {
  id: number;
  title: string;
  description: string;
  video_url: string;
  status: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  username?: string;
  email?: string;
}

interface Group {
  id: number;
  name: string;
}

export default function LearningDashboard() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("learning_training", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { isFullAccess, isViewOnly } = useModuleAccess("learning_training");
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingCourse, setSharingCourse] = useState<Course | null>(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Data
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  
  // Selection State
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  if (!hydrated || !hasRequiredAccess) return null;

  useEffect(() => {
    fetchCourses();
    fetchOrganizationData();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/learning/courses/");
      setCourses(response.data);
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizationData = async () => {
    try {
      // Use dedicated Learning endpoints
      const usersRes = await axiosInstance.get("/learning/courses/users-list/"); 
      const groupsRes = await axiosInstance.get("/learning/courses/groups-list/");
      setAvailableUsers(usersRes.data);
      setAvailableGroups(groupsRes.data);
    } catch (error) {
      console.error("Failed to fetch org data:", error);
    }
  };

  const handleDelete = async (courseId: number) => {
    if (!confirm("Are you sure? This will delete the course for EVERYONE.")) return;
    try {
      await axiosInstance.delete(`/learning/courses/${courseId}/`);
      setCourses(courses.filter((c) => c.id !== courseId));
    } catch (error) {
      alert("Failed to delete.");
    }
  };

  const openShareModal = (course: Course) => {
    setSharingCourse(course);
    setIsShareModalOpen(true);
    setSelectedUserIds([]);
    setSelectedGroupIds([]);
    setStartDate("");
    setDueDate("");
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingCourse) return;

    try {
      await axiosInstance.post(`/learning/courses/${sharingCourse.id}/share/`, {
        users: selectedUserIds,
        groups: selectedGroupIds,
        start_date: startDate,
        due_date: dueDate
      });
      alert("Course Assigned Successfully!");
      setIsShareModalOpen(false);
    } catch (error: any) {
      alert("Assignment Failed: " + (error.response?.data?.detail || "Check inputs"));
    }
  };

  // --- EDIT LOGIC ---
  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    try {
      await axiosInstance.patch(`/learning/courses/${editingCourse.id}/`, {
        title: editingCourse.title,
        description: editingCourse.description,
        video_url: editingCourse.video_url
      });
      fetchCourses(); 
      setIsEditModalOpen(false);
    } catch (error) {
      alert("Update Failed.");
    }
  };

  const getUserLabel = (u: any) => {
    if (u.first_name || u.last_name) return `${u.first_name || ""} ${u.last_name || ""}`.trim();
    if (u.username) return u.username.charAt(0).toUpperCase() + u.username.slice(1);
    return u.email || `User ${u.id}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} title="Learning" description="Manage courses." />

        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <input 
              type="text" 
              placeholder="Filter courses..." 
              className="w-full md:w-96 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3A72EC] outline-none" 
            />
            
            {isFullAccess ? (
              <Link 
                href="/learning/new" 
                className="bg-[#3A72EC] hover:bg-[#2a5dbf] text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <span>+</span> Create New Course
              </Link>
            ) : isViewOnly ? (
              <div
                aria-disabled="true"
                className="bg-slate-400 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 cursor-not-allowed select-none"
              >
                <span>+</span> Create New Course
              </div>
            ) : null}
          </div>

          {loading ? (
             <div className="text-center py-10 text-gray-500">Loading courses...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => (
                <div key={course.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group relative">
                    <div className="h-48 bg-gray-100 relative overflow-hidden">
                        <img src="https://img.freepik.com/free-vector/online-tutorials-concept_52683-37480.jpg" alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        
                        {isFullAccess && (
                          <div className="absolute top-3 right-3 flex gap-2">
                              {/* Share Button */}
                              <button onClick={() => openShareModal(course)} className="bg-white/90 p-2 rounded-full text-[#3A72EC] hover:bg-[#3A72EC] hover:text-white shadow-sm transition-colors" title="Assign">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.5 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm.5-5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 0 1-1 0v-1h-1a.5.5 0 0 1 0-1h1v-1a.5.5 0 0 1 1 0Zm-2-6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M8.256 14a4.474 4.474 0 0 1-.229-1.004H3c.001-.246.154-.986.832-1.664C4.484 10.68 5.711 10 8 10c.26 0 .507.009.74.025.226-.341.496-.65.804-.918C9.077 9.038 8.564 9 8 9c-5 0-6 3-6 4s1 1 1 1h5.256Z"/></svg>
                              </button>
                              {/* Delete Button */}
                              <button onClick={() => handleDelete(course.id)} className="bg-white/90 p-2 rounded-full text-red-500 hover:bg-red-500 hover:text-white shadow-sm transition-colors" title="Delete">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                              </button>
                          </div>
                        )}
                    </div>
                    <div className="p-5">
                        <h3 className="font-bold text-gray-800 text-lg mb-1 truncate">{course.title}</h3>
                        <p className="text-gray-500 text-sm mb-4 line-clamp-2">{course.description || "No description provided."}</p>
                        <div className="flex gap-2">
                            {isFullAccess && (
                              <button onClick={() => openEditModal(course)} className="flex-1 px-4 py-2 bg-gray-50 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors">Edit</button>
                            )}
                            <a href={course.video_url} target="_blank" className="flex-1 px-4 py-2 bg-[#3A72EC]/10 text-[#3A72EC] text-center font-medium rounded-lg hover:bg-[#3A72EC]/20 transition-colors">Play Video</a>
                        </div>
                    </div>
                </div>
                ))}
            </div>
          )}

          {/* EDIT MODAL */}
          {isEditModalOpen && editingCourse && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">Edit Course</h2>
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                        <input className="w-full p-2 border rounded focus:ring-2 focus:ring-[#3A72EC] outline-none text-gray-900" value={editingCourse.title} onChange={e => setEditingCourse({...editingCourse, title: e.target.value})} />
                        <textarea className="w-full p-2 border rounded focus:ring-2 focus:ring-[#3A72EC] outline-none text-gray-900" rows={3} value={editingCourse.description} onChange={e => setEditingCourse({...editingCourse, description: e.target.value})} />
                        <input className="w-full p-2 border rounded focus:ring-2 focus:ring-[#3A72EC] outline-none text-gray-900" value={editingCourse.video_url} onChange={e => setEditingCourse({...editingCourse, video_url: e.target.value})} />
                        <div className="flex justify-end gap-2 mt-4">
                            <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-[#3A72EC] text-white rounded hover:bg-[#2a5dbf] transition-colors">Save</button>
                        </div>
                    </form>
                </div>
            </div>
          )}

          {/* SHARE MODAL (UPDATED WITH MULTI-SELECT) */}
          {isShareModalOpen && sharingCourse && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                    <h2 className="text-xl font-bold mb-1 text-gray-800">Assign Course</h2>
                    <p className="text-sm text-gray-500 mb-4">Assign "{sharingCourse.title}"</p>
                    <form onSubmit={handleShareSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <input type="date" required className="w-full p-2 border rounded focus:ring-2 focus:ring-[#3A72EC] outline-none text-gray-900" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            <input type="date" required className="w-full p-2 border rounded focus:ring-2 focus:ring-[#3A72EC] outline-none text-gray-900" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                        </div>
                        
                        {/* NEW USER DROPDOWN */}
                        <MultiSelectDropdown 
                            label="Assign Users"
                            options={availableUsers}
                            selectedIds={selectedUserIds}
                            onChange={setSelectedUserIds}
                            getLabel={getUserLabel}
                            placeholder="Select users..."
                        />

                        {/* NEW GROUP DROPDOWN */}
                        <MultiSelectDropdown 
                            label="Assign Groups"
                            options={availableGroups}
                            selectedIds={selectedGroupIds}
                            onChange={setSelectedGroupIds}
                            getLabel={(g) => g.name}
                            placeholder="Select groups..."
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <button type="button" onClick={() => setIsShareModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-[#3A72EC] text-white rounded hover:bg-[#2a5dbf] transition-colors">Assign</button>
                        </div>
                    </form>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
