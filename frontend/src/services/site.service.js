import api from "../api/axios";

export const getSites = () => api.get("/sites");

export const createSite = (payload) => api.post("/sites", payload);

export const updateSite = (siteId, payload) => api.put(`/sites/${siteId}`, payload);

export const deleteSiteById = (siteId) => api.delete(`/sites/${siteId}`);

export const getSubSites = (siteId, parentId = "") => {
  const params = parentId ? { parentId } : {};
  return api.get(`/sites/${siteId}/sub-sites`, { params });
};

export const createSubSite = (siteId, payload) =>
  api.post(`/sites/${siteId}/sub-sites`, payload);

export const updateSubSite = (siteId, subSiteId, payload) =>
  api.put(`/sites/${siteId}/sub-sites/${subSiteId}`, payload);

export const deleteSubSiteById = (siteId, subSiteId) =>
  api.delete(`/sites/${siteId}/sub-sites/${subSiteId}`);
