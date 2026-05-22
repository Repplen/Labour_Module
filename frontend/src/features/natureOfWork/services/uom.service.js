import api from "../../../api/axios";

export const getUoms = (params = {}) => api.get("/uom", { params });
export const getActiveUoms = () => api.get("/uom/active");
export const getDefaultUoms = () => api.get("/uom/defaults");
export const createUom = (payload) => api.post("/uom", payload);
export const updateUomStatus = (id, payload) => api.patch(`/uom/${id}/status`, payload);
