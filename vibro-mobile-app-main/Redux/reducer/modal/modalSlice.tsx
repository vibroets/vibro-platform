import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ModalState {
  sessionExpiredVisible: boolean;
}

const initialState: ModalState = {
  sessionExpiredVisible: false,
};

const modalSlice = createSlice({
  name: "modal",
  initialState,
  reducers: {
    showSessionExpiredModal: (state) => {
      state.sessionExpiredVisible = true;
    },
    hideSessionExpiredModal: (state) => {
      state.sessionExpiredVisible = false;
    },
  },
});

export const { showSessionExpiredModal, hideSessionExpiredModal } = modalSlice.actions;

export default modalSlice.reducer;
