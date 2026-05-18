import api from "../api/axios";
import { getChecklistReportParams } from "../utils/checklistReportFilters";

export const getChecklistReportOptions = () =>
  api.get("/checklists/tasks/report/options");

export const getChecklistReportRows = ({ filters, search }) =>
  api.get("/checklists/tasks/report", {
    params: getChecklistReportParams(filters, search),
  });

export const exportChecklistReport = ({ format, filters, search }) =>
  api.get(`/checklists/tasks/report/export/${format}`, {
    params: getChecklistReportParams(filters, search),
    responseType: "blob",
  });
