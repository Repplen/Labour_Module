import api from "../api/axios";

export const getCompanies = () => api.get("/companies");

export const createCompany = (payload) => api.post("/companies", payload);

export const updateCompany = (companyId, payload) =>
  api.put(`/companies/${companyId}`, payload);

export const deleteCompanyById = (companyId) => api.delete(`/companies/${companyId}`);
