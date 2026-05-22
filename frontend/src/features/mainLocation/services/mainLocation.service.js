import api from "../../../api/axios";

export const getMainLocations = (params = {}) =>
  api.get("/main-locations", { params });

export const getMainLocationTree = (params = {}) =>
  api.get("/main-locations/tree", { params });

export const getMainLocationTreeBySite = (siteId, params = {}) =>
  api.get(`/main-locations/by-site/${siteId}`, { params });

export const getMainLocationById = (id) => api.get(`/main-locations/${id}`);

export const createMainLocation = (payload) => api.post("/main-locations", payload);

export const createChildMainLocation = (parentId, payload) =>
  api.post(`/main-locations/${parentId}/children`, payload);

export const updateMainLocation = (id, payload) =>
  api.put(`/main-locations/${id}`, payload);

export const deleteMainLocation = (id, { cascadeChildren = false } = {}) =>
  api.delete(`/main-locations/${id}`, { params: { cascadeChildren } });

export const updateMainLocationStatus = (id, payload) =>
  api.patch(`/main-locations/${id}/status`, payload);
