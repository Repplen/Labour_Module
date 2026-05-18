import { useEffect, useMemo, useState } from "react";
import {
  exportChecklistReport,
  getChecklistReportOptions,
  getChecklistReportRows,
} from "../../services/checklistReport.service";
import {
  buildDefaultChecklistReportFilters,
  buildSubDepartmentOptions,
  getDownloadFileName,
} from "../../utils/checklistReportFilters";

export const useChecklistReport = (scope) => {
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(() => buildDefaultChecklistReportFilters());
  const [appliedFilters, setAppliedFilters] = useState(() =>
    buildDefaultChecklistReportFilters()
  );
  const [loading, setLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [reportScopeStrategy, setReportScopeStrategy] = useState(
    String(scope?.strategy || "").trim().toLowerCase()
  );
  const [ownEmployeeId, setOwnEmployeeId] = useState("");
  const isOwnDataScope = reportScopeStrategy === "own";

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await getChecklistReportOptions();
        const nextEmployees = Array.isArray(response.data?.employees)
          ? response.data.employees
          : [];
        const nextDepartments = Array.isArray(response.data?.departments)
          ? response.data.departments
          : [];
        const nextSites = Array.isArray(response.data?.sites) ? response.data.sites : [];
        const nextScopeStrategy = String(
          response.data?.scopeStrategy || scope?.strategy || ""
        )
          .trim()
          .toLowerCase();
        const nextOwnEmployeeId = String(response.data?.currentPrincipalEmployeeId || "");
        const hasEmployeeScopeBeyondOwn =
          Boolean(nextOwnEmployeeId) &&
          nextEmployees.some((employee) => String(employee?._id || "") !== nextOwnEmployeeId);
        const effectiveScopeStrategy =
          nextScopeStrategy === "own" && hasEmployeeScopeBeyondOwn
            ? "mapped"
            : nextScopeStrategy;

        setEmployees(nextEmployees);
        setDepartments(nextDepartments);
        setSites(nextSites);
        setReportScopeStrategy(effectiveScopeStrategy);
        setOwnEmployeeId(nextOwnEmployeeId);

        if (effectiveScopeStrategy === "own" && nextOwnEmployeeId) {
          const ownFilters = buildDefaultChecklistReportFilters(nextOwnEmployeeId);
          setFilters(ownFilters);
          setAppliedFilters(ownFilters);
        }
      } catch (err) {
        console.error("Checklist report master load failed:", err);
        setEmployees([]);
        setDepartments([]);
        setSites([]);
      }
    };

    void loadOptions();
  }, [scope?.strategy]);

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);

      try {
        const response = await getChecklistReportRows({
          filters: appliedFilters,
          search,
        });

        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Checklist report load failed:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void loadReport();
  }, [appliedFilters, search]);

  const applyFilters = () => {
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      alert("From date cannot be greater than to date");
      return;
    }

    const nextFilters =
      isOwnDataScope && ownEmployeeId
        ? { ...filters, assignedEmployee: ownEmployeeId }
        : { ...filters };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  };

  const clearFilters = () => {
    const resetFilters = buildDefaultChecklistReportFilters(
      isOwnDataScope && ownEmployeeId ? ownEmployeeId : ""
    );
    setFilters(resetFilters);
    setAppliedFilters(resetFilters);
  };

  const subDepartmentOptions = useMemo(
    () => buildSubDepartmentOptions(departments, filters.department),
    [departments, filters.department]
  );

  const companyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (sites || [])
            .map((site) => String(site?.companyName || "").trim())
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })),
    [sites]
  );

  const filteredSites = useMemo(() => {
    if (!filters.companyName) return sites;
    return sites.filter((site) => String(site?.companyName || "") === filters.companyName);
  }, [filters.companyName, sites]);

  const ownEmployeeOption = useMemo(
    () =>
      employees.find(
        (employee) => String(employee?._id || "") === String(ownEmployeeId || "")
      ),
    [employees, ownEmployeeId]
  );

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        const siteIds = Array.isArray(employee.sites)
          ? employee.sites.map((site) => String(site?._id || site))
          : [];
        const companyNames = Array.from(
          new Set(
            (Array.isArray(employee.sites) ? employee.sites : [])
              .map((site) => String(site?.companyName || "").trim())
              .filter(Boolean)
          )
        );
        const departmentIds = Array.isArray(employee.departmentIds)
          ? employee.departmentIds.map((item) => String(item))
          : [];
        const subDepartmentIds = Array.isArray(employee.subDepartment)
          ? employee.subDepartment.map((item) => String(item))
          : [];

        if (filters.companyName && !companyNames.includes(String(filters.companyName))) {
          return false;
        }

        if (filters.siteId && !siteIds.includes(String(filters.siteId))) {
          return false;
        }

        if (filters.department && !departmentIds.includes(String(filters.department))) {
          return false;
        }

        if (filters.subDepartment && !subDepartmentIds.includes(String(filters.subDepartment))) {
          return false;
        }

        return true;
      }),
    [employees, filters.companyName, filters.department, filters.siteId, filters.subDepartment]
  );

  const handleExport = async (format) => {
    setExportingFormat(format);

    try {
      const response = await exportChecklistReport({
        format,
        filters: appliedFilters,
        search,
      });
      const fallbackFileName =
        format === "excel" ? "checklist-task-report.xlsx" : "checklist-task-report.pdf";
      const blob = new Blob([response.data], {
        type: response.headers?.["content-type"] || undefined,
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = getDownloadFileName(response.headers, fallbackFileName);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(`Checklist report ${format} export failed:`, err);
      alert(
        format === "excel"
          ? "Failed to download checklist task report in Excel format"
          : "Failed to download checklist task report in PDF format"
      );
    } finally {
      setExportingFormat("");
    }
  };

  return {
    rows,
    loading,
    search,
    setSearch,
    filters,
    setFilters,
    applyFilters,
    clearFilters,
    handleExport,
    exportingFormat,
    filterOptions: {
      companyOptions,
      departments,
      filteredEmployees,
      filteredSites,
      isOwnDataScope,
      ownEmployeeId,
      ownEmployeeOption,
      subDepartmentOptions,
    },
  };
};
