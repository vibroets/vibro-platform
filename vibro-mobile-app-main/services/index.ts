/* eslint-disable import/no-named-as-default-member */
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { logoutRequest } from '../Redux/reducer/auth/authSlice';
import store from '../store';
import { SecureStoreKeys, SecureStoreService } from "./secureStore";

// Configure your base API URL
const BASE_URL = "https://www.vibroets.com/api"; // production
// const BASE_URL = "http://192.168.1.3:8000/api"; // local network (physical device)
// const BASE_URL = "http://localhost:8000/api"; // iOS Simulator
// const BASE_URL = "http://10.0.2.2:8000/api"; // Android Emulator

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 500000, // 8 mins timeout
  headers: {
    "Content-Type": "application/json",
  },
});

const TASK_DETAIL_CACHE_TTL_MS = 30 * 1000;
const TASK_DETAIL_CACHE = new Map<string, { ts: number; data: any }>();
const TASK_DETAIL_INFLIGHT = new Map<string, Promise<any>>();

const isTaskDetailEndpoint = (endpoint: string) => {
  const normalized = endpoint.trim();
  return /^\/?tasks\/\d+\/?$/.test(normalized);
};

const invalidateTaskDetailCache = () => {
  TASK_DETAIL_CACHE.clear();
  TASK_DETAIL_INFLIGHT.clear();
};

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    const authInfo = (await SecureStoreService?.get(
      SecureStoreKeys.AUTH_INFO
    )) as any;
    if (authInfo?.isAuthenticated) {
      config.headers.Authorization = `Bearer ${authInfo.access}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const res = error.response;
    if (axios.isAxiosError(error)) {
      // 🔒 Handle expired token
      if (
        res?.data?.code === "token_not_valid" &&
        res?.data?.messages?.some(
          (msg: any) => msg.message === "Token is invalid or expired"
        )
      ) {
        store.dispatch(logoutRequest());

        return Promise.reject({
          message: "Session expired. Redirecting to login.",
          status: 401,
          data: res.data,
          isAxiosError: true,
        });
      }

      return Promise.reject({
        message: error.response?.data?.message || error.message,
        status: error.response?.status,
        data: error.response?.data,
        isAxiosError: true,
      });
    }
    return Promise.reject(error);
  }
);

// GET request
export const get = async <T>(
  endpoint: string,
  params?: Record<string, any>,
  config?: AxiosRequestConfig
): Promise<T> => {
  try {
    const skipCache = Boolean(config?.headers && (config.headers as any)["x-skip-cache"]);
    if (!skipCache && !params && isTaskDetailEndpoint(endpoint)) {
      const now = Date.now();
      const cached = TASK_DETAIL_CACHE.get(endpoint);
      if (cached && now - cached.ts < TASK_DETAIL_CACHE_TTL_MS) {
        return cached.data as T;
      }
      const inflight = TASK_DETAIL_INFLIGHT.get(endpoint);
      if (inflight) return (await inflight) as T;

      const promise = (async () => {
        const response = await api.get<T>(endpoint, { ...config, params });
        TASK_DETAIL_CACHE.set(endpoint, { ts: Date.now(), data: response.data });
        return response.data;
      })();
      TASK_DETAIL_INFLIGHT.set(endpoint, promise);
      try {
        return (await promise) as T;
      } finally {
        TASK_DETAIL_INFLIGHT.delete(endpoint);
      }
    }

    const response = await api.get<T>(endpoint, { ...config, params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// POST request
export const post = async <T>(
  endpoint: string,
  data?: Record<string, any>,
  config?: AxiosRequestConfig
): Promise<T> => {
  try {
    if (endpoint.startsWith("/tasks/")) {
      invalidateTaskDetailCache();
    }
    const response = await api.post<T>(endpoint, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// PUT request
export const put = async <T>(
  endpoint: string,
  data?: Record<string, any>,
  config?: AxiosRequestConfig
): Promise<T> => {
  try {
    if (endpoint.startsWith("/tasks/")) {
      invalidateTaskDetailCache();
    }
    const response = await api.put<T>(endpoint, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// PATCH request
export const patch = async <T>(
  endpoint: string,
  data?: Record<string, any>,
  config?: AxiosRequestConfig
): Promise<T> => {
  try {
    if (endpoint.startsWith("/tasks/")) {
      invalidateTaskDetailCache();
    }
    const response = await api.patch<T>(endpoint, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// DELETE request
export const del = async <T>(
  endpoint: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  try {
    if (endpoint.startsWith("/tasks/")) {
      invalidateTaskDetailCache();
    }
    const response = await api.delete<T>(endpoint, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Export the configured axios instance
export default api;
