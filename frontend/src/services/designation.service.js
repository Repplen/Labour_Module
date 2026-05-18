import api from "../api/axios";

export const getDesignations = () => api.get("/designations");

export const createDesignation = (payload) => api.post("/designations", payload);

export const updateDesignation = (designationId, payload) =>
  api.put(`/designations/${designationId}`, payload);

export const deleteDesignationById = (designationId) =>
  api.delete(`/designations/${designationId}`);
