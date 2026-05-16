import api from "../api/axios";

export const getEmployees = () => api.get("/employees");
