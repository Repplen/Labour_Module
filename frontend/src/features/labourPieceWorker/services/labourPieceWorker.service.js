import api from "../../../api/axios";

export const getLabourPieceWorkers = (params = {}) => api.get("/labour-piece-workers", { params });
export const getActiveLabourPieceWorkers = (params = {}) => api.get("/labour-piece-workers/active", { params });
export const getLabourPieceWorkerById = (id) => api.get(`/labour-piece-workers/${id}`);
export const createLabourPieceWorker = (payload) => api.post("/labour-piece-workers", payload);
export const updateLabourPieceWorker = (id, payload) => api.put(`/labour-piece-workers/${id}`, payload);
export const deleteLabourPieceWorker = (id) => api.delete(`/labour-piece-workers/${id}`);
export const updateLabourPieceWorkerStatus = (id, payload) =>
  api.patch(`/labour-piece-workers/${id}/status`, payload);
