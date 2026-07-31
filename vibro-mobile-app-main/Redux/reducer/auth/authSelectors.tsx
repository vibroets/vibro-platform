import { RootState } from "../rootReducer";

export const selectToken = (state: RootState) => state.auth.access;
export const selectAuthLoading = (state: RootState) => state.auth.loading;
export const selectAuthError = (state: RootState) => state.auth.error;
