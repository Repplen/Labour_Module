import api from "../api/axios";

export const getChecklistTransferHistory = (params = {}) =>
  api.get("/checklists/transfers/history", { params });

export const getChecklistTransferChecklists = (fromEmployeeId) =>
  api.get("/checklists/transfers/checklists", {
    params: { fromEmployeeId },
  });

export const createPermanentChecklistTransfer = (payload) =>
  api.post("/checklists/transfers/permanent", payload);

export const createTemporaryChecklistTransfer = (payload) =>
  api.post("/checklists/transfers/temporary", payload);
