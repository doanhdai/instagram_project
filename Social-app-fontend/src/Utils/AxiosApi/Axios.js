import axios from "axios";
import store from "../../Redux/store";
import { userLogoutALL } from "../../Redux/Reducer/UserAppDeucer";

const instance = axios.create({
  baseURL: "http://localhost:8081/api/v1",
  withCredentials: true, // Cho phép gửi cookie với request
});

// Thêm interceptor để đính kèm token vào headers
instance.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.login?.accessToken;

    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;   
    }
    return config;
  },
  (error) => Promise.reject(error)
);

instance.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.get("http://localhost:8081/api/v1/auth/refresh", {
          withCredentials: true,
        });
        return instance(originalRequest);
      } catch (err) {
        console.error("Refresh token failed, redirecting to login...");

        store.dispatch(userLogoutALL());
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default instance;
