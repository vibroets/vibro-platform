import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface RoleDetails {
  description : string;
  id: number | null;
  name: string
}

interface UserState {
  id: number | null;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  division: number | null;
  department: number | null;
  location: number | null;
  role: string;
  status: string;
  organization: string;
  organizationId: number | null;
  organizationName: string;
  roleDetails: RoleDetails
}

const initialState: UserState = {
  id: null,
  username: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  division: null,
  department: null,
  location: null,
  role: "",
  status: "",
  organization: "",
  organizationId: null,
  organizationName: "",
  roleDetails: {
    description: "",
    id: null,
    name: ""
  }
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUserProfile: (state, action: PayloadAction<Partial<UserState>>) => {
      return { ...state, ...action.payload };
    },
    clearUserProfile: () => initialState,
  },
});

export const { setUserProfile, clearUserProfile } = userSlice.actions;

export default userSlice.reducer;
