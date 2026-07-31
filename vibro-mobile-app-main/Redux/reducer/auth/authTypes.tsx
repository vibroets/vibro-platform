export interface AuthState {
  refresh: string | null;
  user: null | object;
  access: string | null;
  loading: boolean;
  error: string | null;
  module_permissions: string | null | any[];
  isAuthenticated: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginSuccessPayload {
  token: string;
}

export const initialState: AuthState = {
  refresh: null,
  access: null,
  user: null,
  loading: false,
  error: null,
  module_permissions: null,
  isAuthenticated: false,
};
