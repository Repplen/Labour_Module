import api from "../../../api/axios";

export const getNatureOfWorks = (params = {}) => api.get("/nature-of-work", { params });
export const getNatureOfWorkTree = (params = {}) => api.get("/nature-of-work/tree", { params });
export const getNatureOfWorkById = (id) => api.get(`/nature-of-work/${id}`);
export const getActiveNatureOfWorks = () => api.get("/nature-of-work/active");
export const createNatureOfWork = (payload) => api.post("/nature-of-work", payload);
export const createChildNatureOfWork = (parentId, payload) =>
  api.post(`/nature-of-work/${parentId}/children`, payload);
export const updateNatureOfWork = (id, payload) => api.put(`/nature-of-work/${id}`, payload);
export const deleteNatureOfWork = (id, { cascadeChildren = false } = {}) =>
  api.delete(`/nature-of-work/${id}`, { params: { cascadeChildren } });
export const updateNatureOfWorkStatus = (id, payload) =>
  api.patch(`/nature-of-work/${id}/status`, payload);
