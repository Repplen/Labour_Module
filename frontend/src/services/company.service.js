import api from "../api/axios";

export const getCompanies = () => api.get("/companies");
