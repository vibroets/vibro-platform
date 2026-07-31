// Announcement reducer
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AnnouncementItem {
  id: number;
  title: string;
  announcement_category: string;
  announcement_start_date: string;
  announcement_end_date?: string;
  pin_as_important: boolean;
  request_acknowledge: boolean;
  prevent_download: boolean;
  announcement_content: string;
  announcement_tags?: string;
  announcement_attachments?: string;
  organization: number;
  organization_name: string;
  created_by: number;
  created_by_name: string;
  created_on: string;
  updated_by?: number;
  updated_by_name?: string;
  updated_on?: string;
  // Local status fields
  viewed: boolean;
  liked: boolean;
  acknowledged: boolean;
  notified: boolean;
}

interface AnnouncementsState {
  announcements: AnnouncementItem[];
  loading: boolean;
  error: string | null;
}

const initialState: AnnouncementsState = {
  announcements: [],
  loading: false,
  error: null,
};

const announcementsSlice = createSlice({
  name: "announcements",
  initialState,
  reducers: {
    fetchAnnouncements: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchAnnouncementsSuccess: (state, action: PayloadAction<AnnouncementItem[]>) => {
      // Preserve server-provided status flags or prior local state so viewed/liked
      // announcements don't reappear as unread after a refresh.
      state.announcements = action.payload.map(item => {
        const existing = state.announcements.find(a => a.id === item.id);
        return {
          ...item,
          viewed: item.viewed ?? existing?.viewed ?? false,
          liked: item.liked ?? existing?.liked ?? false,
          acknowledged: item.acknowledged ?? existing?.acknowledged ?? false,
          notified: item.notified ?? existing?.notified ?? false,
        };
      });
      state.loading = false;
      state.error = null;
    },
    fetchAnnouncementsFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    patchAnnouncement: (state, action: PayloadAction<{ id: number; type: 'viewed' | 'acknowledged' | 'liked' | 'notified'; value: boolean }>) => {
      const { id, type, value } = action.payload;
      const item = state.announcements.find(a => a.id === id);
      if (item) {
        item[type] = value;
      }
    },
    markAllAsNotified: (state) => {
      state.announcements.forEach(item => {
        item.notified = true;
      });
    },
  },
});

export const { fetchAnnouncements, fetchAnnouncementsSuccess, fetchAnnouncementsFailure, patchAnnouncement, markAllAsNotified } = announcementsSlice.actions;
export default announcementsSlice.reducer;
