import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

interface CreatedAnnouncement {
  id: number;
  title: string;
  user: any[];
  group: any[];
}

interface AnnouncementState {
  createdAnnouncement: CreatedAnnouncement | null;
}

const initialState: AnnouncementState = {
  createdAnnouncement: null,
};

const announcementSlice = createSlice({
  name: 'announcement',
  initialState,
  reducers: {
    setCreatedAnnouncement: (state, action: PayloadAction<CreatedAnnouncement>) => {
      state.createdAnnouncement = action.payload;
    },
    clearCreatedAnnouncement: (state) => {
      state.createdAnnouncement = null;
    },
  },
});

export const selectCreatedAnnouncement = (state: RootState) => state.announcement.createdAnnouncement;

export const { setCreatedAnnouncement, clearCreatedAnnouncement } = announcementSlice.actions;

export default announcementSlice.reducer;
