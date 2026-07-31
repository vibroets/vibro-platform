import { store } from "@/redux/store";
import axios from "axios";
import { showWarningToast } from "./hotToastsUtils";



// const base_url = "https://api.vibroets.com/api"  //prod new
// const base_url = "https://api.vibro.mooo.com/api"  //prod
const base_url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"  //local
// const base_url = "http://43.205.114.131:8001/api"  //qa
// const base_url = "https://vibroenv.mooo.com/api"  //qa-dns
// const base_url = "/api"; //PROD




const axiosInstance = axios.create({
  baseURL: base_url,  
  headers: {
    "Content-Type": "application/json",
  },
});


// ---------------------------------------------
// Lightweight GET de-duplication + short caching
// ---------------------------------------------
type AnyConfig = any;
type AnyResponse = any;

const inFlightRequests = new Map<string, Promise<AnyResponse>>();
const responseCache = new Map<string, { timestamp: number; response: AnyResponse }>();
const CACHE_TTL_MS = 5000; // 5s window to reuse recent GETs

function stableStringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "object") return String(value);
  const allKeys: string[] = [];
  JSON.stringify(value, (key, val) => { allKeys.push(key); return val; });
  allKeys.sort();
  return JSON.stringify(value, allKeys);
}

function buildRequestKey(config: AnyConfig): string {
  const method = (config.method || "get").toLowerCase();
  const url = (config.baseURL || "") + (config.url || "");
  const paramsKey = stableStringify(config.params);
  const dataKey = stableStringify(config.data);
  return `${method}:${url}?p=${paramsKey}&d=${dataKey}`;
}

const originalRequest = axiosInstance.request.bind(axiosInstance);

axiosInstance.request = function dedupedRequest(config: AnyConfig): Promise<AnyResponse> {
  // Support axios(url, config) signature
  const normalizedConfig: AnyConfig = typeof config === "string" ? { url: config } : (config || {});
  const method = (normalizedConfig.method || "get").toLowerCase();

  if (method !== "get") {
    return originalRequest(normalizedConfig);
  }

  const key = buildRequestKey({ ...normalizedConfig, baseURL: axiosInstance.defaults.baseURL });
  const now = Date.now();

  // Serve from short cache if fresh
  const cached = responseCache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return Promise.resolve(cached.response);
  }

  // Share in-flight promise for duplicate GETs
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing;
  }

  const reqPromise = originalRequest(normalizedConfig)
    .then((resp: AnyResponse) => {
      responseCache.set(key, { timestamp: Date.now(), response: resp });
      return resp;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, reqPromise);
  return reqPromise;
};

const skipAuthEndpoints = [
  "/auth/request-otp/",
  "/auth/verify-otp/",
];

// Request Interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.tokens?.access;
    const shouldSkip = skipAuthEndpoints.some((url) =>
      config.url?.includes(url)
    );

    if (!shouldSkip && token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor for global error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response &&
      error.response.data &&
      error.response.data.code === "token_not_valid"
    ) {
      showWarningToast(
      "Session expired.\nPlease logout and login again.",
      "warning",
      "Ok"
    ).then(() => {
      // This will run when user clicks OK
      window.dispatchEvent(new Event("route-loader-start"));
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      store.dispatch({ type: "auth/logout" });
      window.location.href = "/login";
    });
    }

    return Promise.reject(error);
  }
);


export default axiosInstance;
