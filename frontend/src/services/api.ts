import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

if (!API_BASE) {
  throw new Error("VITE_API_BASE_URL is not defined in environment");
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60_000,
  headers: {
    "Content-Type": "application/json",
  },
});

export function createWebSocketUrl(path: string, query: Record<string, string> = {}): string {
  const url = new URL(path, API_BASE);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Normalize axios error structure
    const errObj = {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    };
    return Promise.reject(errObj);
  }
);

export default api;
