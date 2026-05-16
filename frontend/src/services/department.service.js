import api from "../api/axios";

export const getDepartments = () => api.get("/departments");

export const createDepartment = (payload) => api.post("/departments", payload);

export const updateDepartment = (departmentId, payload) =>
  api.put(`/departments/${departmentId}`, payload);

export const deleteDepartmentById = (departmentId) =>
  api.delete(`/departments/${departmentId}`);

export const getSubDepartments = (departmentId, parentId = "") => {
  const params = parentId ? { parentId } : {};
  return api.get(`/departments/${departmentId}/sub-departments`, { params });
};

export const createSubDepartment = (departmentId, payload) =>
  api.post(`/departments/${departmentId}/sub-departments`, payload);

export const updateSubDepartment = (departmentId, subDepartmentId, payload) =>
  api.put(`/departments/${departmentId}/sub-departments/${subDepartmentId}`, payload);

export const deleteSubDepartmentById = (departmentId, subDepartmentId) =>
  api.delete(`/departments/${departmentId}/sub-departments/${subDepartmentId}`);
