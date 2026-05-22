import api from "../../../api/axios";

export const getMaterials = (params = {}) => api.get("/materials", { params });
export const getActiveMaterials = (params = {}) => api.get("/materials/active", { params });
export const getMaterialById = (id) => api.get(`/materials/${id}`);
export const createMaterial = (payload) => api.post("/materials", payload);
export const updateMaterial = (id, payload) => api.put(`/materials/${id}`, payload);
export const deleteMaterial = (id) => api.delete(`/materials/${id}`);
export const updateMaterialStatus = (id, payload) => api.patch(`/materials/${id}/status`, payload);
