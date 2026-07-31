import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store'; // Adjust this path if needed

interface ModuleAccess {
  module: string;
  access: "no_access" | "view_only" | "full_access";
}

interface ModulePermission {
  module: string;
  access: "no_access" | "view_only" | "full_access";
}


interface RoleDetails {
  id: number;
  name: string;
  description: string;
}

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role_details: RoleDetails;
  module_access: ModuleAccess[];
  organization_id: number; 
  module_permissions: ModulePermission[]; // ✅ Add this line
  role: string;
  organization_name: string; 
  organization: number; // Assuming organization is a string, adjust type if needed
  is_superadmin: boolean;
  is_admin: boolean;
  // Add other fields if needed
}

interface Tokens {
  access: string;
  refresh: string;
}

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  hydrated: boolean; // <-- Add this

}

const initialState: AuthState = {
  user: null,
  tokens: null,
  hydrated: false, // <-- Init as false

};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      localStorage.setItem("user", JSON.stringify(action.payload));
    },
    setTokens: (state, action: PayloadAction<Tokens>) => {
      state.tokens = action.payload;
      localStorage.setItem("access_token", action.payload.access);
      localStorage.setItem("refresh_token", action.payload.refresh);
    },
    clearAuth: (state) => {
      state.user = null;
      state.tokens = null;
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user"); // ✅ Clear stored user
    },

    rehydrateAuth: (state) => {
      const access = localStorage.getItem("access_token");
      const refresh = localStorage.getItem("refresh_token");
      const user = localStorage.getItem("user");

      if (access && refresh) {
        state.tokens = { access, refresh };
      }

      if (user) {
        state.user = JSON.parse(user);
      }

      state.hydrated = true; // ✅ Mark as hydrated
    }

  },
});


export const selectAccessToken = (state: RootState) => state.auth.tokens?.access;
export const selectRefreshToken = (state: RootState) => state.auth.tokens?.refresh;
export const selectUser = (state: RootState) => state.auth.user;

export const { setUser, setTokens, clearAuth, rehydrateAuth } = authSlice.actions;
export const selectHydrated = (state: RootState) => state.auth.hydrated;

export default authSlice.reducer;
