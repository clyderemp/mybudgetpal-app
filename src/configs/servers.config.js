import axios from "axios";
const ENV = import.meta.env;

// Load endpoints from .env
const BACKEND_ENDPOINT = ENV.VITE_BACKEND_ENDPOINT;
const AIA_ENDPOINT = ENV.VITE_AIA_ENDPOINT;
export const MODE = ENV.MODE;

console.log(`RUNNING ON ${MODE?.toUpperCase()} MODE.`);

export const backendApi = axios.create({
  baseURL: BACKEND_ENDPOINT,
  withCredentials: true,
  headers: {
    "AiA-Connection": "true",
  },
});

export const aiaApi = axios.create({
  baseURL: AIA_ENDPOINT,
  withCredentials: true,
  headers: {
    "AiA-Connection": "true",
  },
});

// Add token interceptor (optional)
[backendApi, aiaApi].forEach((instance) => {
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(error)
  );
});
