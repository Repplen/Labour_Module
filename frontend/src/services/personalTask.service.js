import api from "../api/axios";

export const getPersonalTasks = ({ search = "", status = "" } = {}) =>
  api.get("/personal-tasks", {
    params: {
      search: search || undefined,
      status: status || undefined,
    },
  });

export const getPersonalTaskById = (taskId) => api.get(`/personal-tasks/${taskId}`);

export const createPersonalTask = (payload) =>
  api.post("/personal-tasks", payload, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getShareableEmployees = () => api.get("/personal-tasks/shareable-employees");

export const sharePersonalTask = (taskId, assignedEmployeeId) =>
  api.post(`/personal-tasks/${taskId}/share`, { assignedEmployeeId });

export const completePersonalTask = (taskId) =>
  api.patch(`/personal-tasks/${taskId}/complete`);

export const updatePersonalTask = (taskId, payload) =>
  api.put(`/personal-tasks/${taskId}`, payload, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deletePersonalTask = (taskId) =>
  api.delete(`/personal-tasks/${taskId}`);

export const markPersonalTaskRead = (taskId) =>
  api.post(`/personal-tasks/${taskId}/read`);

export const getPersonalTaskUploadBaseUrl = () =>
  (api.defaults.baseURL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
