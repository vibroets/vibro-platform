// /stores/excelJobStore.ts
import { create } from "zustand";

interface CompletedJob {
    id: string;
    type: "excel" | "pdf";
    status: "SUCCESS" | "FAILED";
    message: string;
    timestamp: string;
    filename?: string;
}

interface ExcelJobStore {
    completedJobs: CompletedJob[];
    addJob: (job: CompletedJob) => void;
    clearJob: (id: string) => void;
}

export const useExcelJobStore = create<ExcelJobStore>((set) => ({
    completedJobs: [],
    addJob: (job) =>
        set((state) => ({
            completedJobs: [job, ...state.completedJobs], // newest on top
        })),
    clearJob: (id) =>
        set((state) => ({
            completedJobs: state.completedJobs.filter((j) => j.id !== id),
        })),
}));
