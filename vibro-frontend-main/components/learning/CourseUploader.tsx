"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import axiosInstance from "@/utils/axiosInstance";

// --- REUSABLE MULTI-SELECT COMPONENT ---
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

  // Filter options based on search
  const filteredOptions = options.filter(opt => 
    getLabel(opt).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Toggle selection logic
  const toggleOption = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(sid => sid !== id)); // Remove
    } else {
      onChange([...selectedIds, id]); // Add
    }
  };

  // Close dropdown when clicking outside
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
      
      {/* Trigger Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-3 border rounded bg-white cursor-pointer flex justify-between items-center ${isOpen ? 'ring-2 ring-[#3A72EC] border-transparent' : 'border-gray-300'}`}
      >
        <span className={selectedIds.length > 0 ? "text-gray-900" : "text-gray-400"}>
          {selectedIds.length > 0 
            ? `${selectedIds.length} Selected` 
            : placeholder}
        </span>
        <span className="text-gray-500 text-xs">▼</span>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 flex flex-col">
          
          {/* Search Bar */}
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

          {/* Options List */}
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

export default function CourseUploader() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({ 
    title: "", description: "", video_url: "", duration: "10 mins", status: "active" 
  });
  const [createdCourseId, setCreatedCourseId] = useState<number | null>(null);

  // Data for Step 2
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  
  // Selections
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    const fetchData = async () => {
        try {
            // Use dedicated Learning endpoints
            const u = await axiosInstance.get("/learning/courses/users-list/");
            const g = await axiosInstance.get("/learning/courses/groups-list/");
            setAvailableUsers(u.data);
            setAvailableGroups(g.data);
        } catch(e) { console.error("Error fetching org data", e); }
    };
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        const res = await axiosInstance.post("/learning/courses/", formData);
        setCreatedCourseId(res.data.id);
        setStep(2);
    } catch (error: any) {
        alert("Creation Failed: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!createdCourseId) return;
    setLoading(true);
    try {
        await axiosInstance.post(`/learning/courses/${createdCourseId}/share/`, {
            users: selectedUserIds,
            groups: selectedGroupIds,
            start_date: startDate,
            due_date: dueDate
        });
        alert("Course Created & Assigned!");
        router.push("/learning");
    } catch (error: any) {
        alert("Assignment Failed: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  const handleSkip = () => {
    alert("Course Created (Unassigned).");
    router.push("/learning");
  };

  // --- SMART NAME DISPLAY LOGIC ---
  const getUserLabel = (u: any) => {
      // 1. Try First Name + Last Name
      if (u.first_name || u.last_name) {
          return `${u.first_name || ""} ${u.last_name || ""}`.trim();
      }
      // 2. Fallback to Capitalized Username
      if (u.username) {
          return u.username.charAt(0).toUpperCase() + u.username.slice(1);
      }
      // 3. Last Resort: Email
      return u.email || `User ${u.id}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} title={step === 1 ? "Create Course" : "Assign Course"} description="Add training." />
        
        <div className="p-8 max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-md p-8">
                
                {step === 1 && (
                    <form onSubmit={handleCreate} className="space-y-6">
                        <h2 className="text-xl font-bold text-gray-800">Step 1: Course Details</h2>
                        <div>
                            <label className="block text-sm font-bold mb-2 text-gray-700">Title</label>
                            <input required className="w-full p-3 border rounded text-gray-900 focus:ring-2 focus:ring-[#3A72EC] outline-none" placeholder="e.g. Intro to AI" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 text-gray-700">Description</label>
                            <textarea className="w-full p-3 border rounded text-gray-900 focus:ring-2 focus:ring-[#3A72EC] outline-none" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 text-gray-700">Video URL</label>
                            <input required type="url" className="w-full p-3 border rounded text-gray-900 focus:ring-2 focus:ring-[#3A72EC] outline-none" placeholder="https://..." value={formData.video_url} onChange={e => setFormData({...formData, video_url: e.target.value})} />
                        </div>
                        <button disabled={loading} type="submit" className="w-full py-3 bg-[#3A72EC] text-white font-bold rounded hover:bg-[#2a5dbf] transition-colors">
                            {loading ? "Saving..." : "Next: Assign Users →"}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-gray-800">Step 2: Assign Course</h2>
                        <p className="text-gray-500 text-sm">Course created! Now select who needs to take it.</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Start Date</label>
                                <input type="date" className="w-full p-2 border rounded text-gray-900 focus:ring-2 focus:ring-[#3A72EC] outline-none" onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Due Date</label>
                                <input type="date" className="w-full p-2 border rounded text-gray-900 focus:ring-2 focus:ring-[#3A72EC] outline-none" onChange={e => setDueDate(e.target.value)} />
                            </div>
                        </div>

                        {/* --- NEW SEARCHABLE DROPDOWN FOR USERS --- */}
                        <MultiSelectDropdown 
                            label="Select Users"
                            options={availableUsers}
                            selectedIds={selectedUserIds}
                            onChange={setSelectedUserIds}
                            getLabel={getUserLabel}
                            placeholder="Select users to assign..."
                        />

                        {/* --- NEW SEARCHABLE DROPDOWN FOR GROUPS --- */}
                        <MultiSelectDropdown 
                            label="Select Groups"
                            options={availableGroups}
                            selectedIds={selectedGroupIds}
                            onChange={setSelectedGroupIds}
                            getLabel={(g) => g.name}
                            placeholder="Select groups to assign..."
                        />

                        <div className="flex gap-4 pt-4">
                            <button onClick={handleSkip} className="w-1/3 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded">Skip & Finish</button>
                            <button onClick={handleAssign} disabled={loading} className="w-2/3 py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700">
                                {loading ? "Assigning..." : "Assign & Finish"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}