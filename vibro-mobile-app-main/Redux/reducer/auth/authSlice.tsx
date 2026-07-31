import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./authTypes";

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    checkRefetchToken: (state, action: PayloadAction<any>) => {
      state.loading = true;
      state.error = null;
    },
    refetchTokenSuccess: (state, action: PayloadAction<any>) => {
      return {
        ...state,
        loading: false,
        ...action?.payload,
      };
    },
    refetchTokenSuccessFailure: (state, action: PayloadAction<any>) => {
      state.loading = false;
      state.error = action?.payload;
    },
    logoutRequest: (state) => {
      return {
        ...state,
        ...initialState,
        loading: true,
      };
    },
    logoutSuccess: (state) => {
      return {
        ...initialState,
      };
    },
  },
});

export const {
  checkRefetchToken,
  refetchTokenSuccess,
  refetchTokenSuccessFailure,
  logoutRequest,
  logoutSuccess,
} = authSlice.actions;

export default authSlice.reducer;
