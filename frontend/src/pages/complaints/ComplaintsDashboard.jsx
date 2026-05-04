import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  createComplaint,
  getComplaintDashboard,
  getComplaintOptions,
} from "../../api/complaintApi";
import ComplaintQuickSubmitCard from "../../components/complaints/ComplaintQuickSubmitCard";
import { usePermissions } from "../../context/usePermissions";
import {
  buildComplaintDrilldownFilters,
  buildComplaintQueryParams,
  complaintStatusToneMap,
} from "../../utils/complaintReporting";
import "../../styles/complaintsWorkspace.css";

const defaultForm = {
  departmentId: "",
  complaintText: "",
  attachment: null,
};

const emptyDashboardData = {
  summary: {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    overdue: 0,
    pendingDepartmentHead: 0,
    pendingSiteHead: 0,
    pendingMainAdmin: 0,
    actionRequired: 0,
  },
  cards: [],
  charts: {
    statusWise: [],
    departmentWise: [],
    siteWise: [],
    monthlyTrend: [],
    pendingLevelWise: [],
  },
  filterOptions: {
    companies: [],
    sites: [],
    departments: [],
    employees: [],
    complaintStatuses: [],
    complaintLevels: [],
  },
};

const chartPalette = ["#0f766e", "#0f5aa8", "#1e3a8a", "#ca8a04", "#b91c1c", "#475569"];

const complaintChartTooltip = ({ active, payload, label }) => {
  if (!active || !Array.isArray(payload) || !payload.length) {
    return null;
  }

  const value = Number(payload[0]?.value || payload[0]?.payload?.count || 0);
  return (
    <div className="complaint-chart-tooltip">
      <div className="fw-semibold">{label || payload[0]?.payload?.label || payload[0]?.name}</div>
      <div>{value} complaint{value === 1 ? "" : "s"}</div>
    </div>
  );
};

export default function ComplaintsDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can, user } = usePermissions();
  const fileInputRef = useRef(null);
  const canAddComplaint = can("complaints", "add");
  const isEmployeePrincipal = user?.principalType === "employee";

  const [options, setOptions] = useState({
    currentEmployee: null,
    departments: [],
  });
  const [dashboardData, setDashboardData] = useState(emptyDashboardData);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const complaintId = String(searchParams.get("complaintId") || "").trim();
    if (!complaintId) return;

    navigate(`/complaints/reports?${searchParams.toString()}`, { replace: true });
  }, [navigate, searchParams]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await getComplaintOptions();
        setOptions({
          currentEmployee: response.data?.currentEmployee || null,
          departments: Array.isArray(response.data?.departments) ? response.data.departments : [],
        });
      } catch (error) {
        console.error("Complaint option load failed:", error);
        setOptions({
          currentEmployee: null,
          departments: [],
        });
      }
    };

    void loadOptions();
  }, []);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const response = await getComplaintDashboard();
        setDashboardData({
          ...emptyDashboardData,
          ...(response.data || {}),
        });
      } catch (error) {
        console.error("Complaint dashboard load failed:", error);
        setDashboardData(emptyDashboardData);
        setLoadError(
          error.response?.data?.message || "Complaint dashboard could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  const departmentOptions = Array.isArray(options.departments) ? options.departments : [];

  const openReportWithFilters = (extraFilters = {}) => {
    const nextParams = buildComplaintQueryParams(
      buildComplaintDrilldownFilters({}, extraFilters)
    );
    const queryString = nextParams.toString();

    navigate(`/complaints/reports${queryString ? `?${queryString}` : ""}`);
  };

  const handleCreateComplaint = async () => {
    if (!form.departmentId) {
      alert("Select a department");
      return;
    }

    if (!form.complaintText.trim()) {
      alert("Enter complaint details");
      return;
    }

    setSaving(true);

    try {
      const payload = new FormData();
      payload.append("departmentId", form.departmentId);
      payload.append("complaintText", form.complaintText.trim());

      if (form.attachment) {
        payload.append("attachment", form.attachment);
      }

      const response = await createComplaint(payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const complaintId = response.data?.complaint?._id || "";

      alert(response.data?.message || "Complaint submitted successfully");
      setForm(defaultForm);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      const refreshedResponse = await getComplaintDashboard();
      setDashboardData({
        ...emptyDashboardData,
        ...(refreshedResponse.data || {}),
      });

      if (complaintId) {
        navigate(`/complaints/reports?complaintId=${complaintId}`);
      }
    } catch (error) {
      console.error("Complaint create failed:", error);
      alert(error.response?.data?.message || "Failed to submit complaint");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="container-fluid mt-4 mb-5 complaints-workspace complaints-dashboard"
      data-testid="complaint-page"
    >
      <div className="page-intro-card complaint-hero-card mb-4">
        <div className="list-toolbar align-items-start">
          <div>
            <div className="page-kicker">Complaints</div>
            <h3 className="mb-1">Complaints Dashboard</h3>
            <p className="page-subtitle mb-0">
              Track complaint flow, time limit exposure, and pending ownership across department head,
              site head, and main admin levels.
            </p>
          </div>

          <div className="d-flex flex-wrap gap-2 complaint-hero-actions">
            <button
              type="button"
              className="btn btn-light complaint-hero-actions__primary"
              onClick={() => openReportWithFilters()}
            >
              Open Complaint Report
            </button>
            <Link className="btn btn-outline-light" to="/complaints/reports">
              Reports Screen
            </Link>
          </div>
        </div>

        <div className="complaint-summary-strip mt-4">
          <div className="complaint-summary-pill">
            <span>Visible Complaints</span>
            <strong>{dashboardData.summary.total || 0}</strong>
          </div>
          <div className="complaint-summary-pill">
            <span>Action Required</span>
            <strong>{dashboardData.summary.actionRequired || 0}</strong>
          </div>
          <div className="complaint-summary-pill">
            <span>Overdue</span>
            <strong>{dashboardData.summary.overdue || 0}</strong>
          </div>
        </div>
      </div>

      {canAddComplaint && isEmployeePrincipal ? (
        <div className="mb-4">
          <ComplaintQuickSubmitCard
            currentEmployee={options.currentEmployee}
            user={user}
            departmentOptions={departmentOptions}
            form={form}
            setForm={setForm}
            fileInputRef={fileInputRef}
            onSubmit={handleCreateComplaint}
            saving={saving}
          />
        </div>
      ) : null}

      {loadError ? <div className="alert alert-warning mb-4">{loadError}</div> : null}

      <div className="complaint-card-grid mb-4">
        {dashboardData.cards.map((card) => {
          const toneClass =
            complaintStatusToneMap[card.tone]?.className ||
            complaintStatusToneMap.neutral.className;

          return (
            <button
              type="button"
              key={card.key}
              className={`complaint-stat-card ${toneClass}`}
              onClick={() => openReportWithFilters(card.drilldownFilters || {})}
            >
              <div className="complaint-stat-card__label">{card.label}</div>
              <div className="complaint-stat-card__value">{card.value || 0}</div>
              <div className="complaint-stat-card__cta">Open filtered report</div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="soft-card text-center py-5 text-muted">
          Loading complaint dashboard...
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-12 col-xl-6">
            <DashboardChartCard title="Complaint Status Summary">
              {dashboardData.charts.statusWise?.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={dashboardData.charts.statusWise}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={70}
                      outerRadius={105}
                      paddingAngle={3}
                    >
                      {dashboardData.charts.statusWise.map((entry, index) => (
                        <Cell key={entry.key} fill={chartPalette[index % chartPalette.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={complaintChartTooltip} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState label="No complaints available for the selected filters." />
              )}
            </DashboardChartCard>
          </div>

          <div className="col-12 col-xl-6">
            <DashboardChartCard title="Pending Level-wise Complaint Summary">
              {dashboardData.charts.pendingLevelWise?.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dashboardData.charts.pendingLevelWise}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={complaintChartTooltip} />
                    <Bar dataKey="count" radius={[12, 12, 0, 0]} fill="#0f766e" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState label="No pending complaints found." />
              )}
            </DashboardChartCard>
          </div>

          <div className="col-12 col-xl-6">
            <DashboardChartCard title="Department-wise Complaint Count">
              {dashboardData.charts.departmentWise?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.charts.departmentWise} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip content={complaintChartTooltip} />
                    <Bar dataKey="count" radius={[0, 12, 12, 0]} fill="#1d4ed8" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState label="No department data available." />
              )}
            </DashboardChartCard>
          </div>

          <div className="col-12 col-xl-6">
            <DashboardChartCard title="Site-wise Complaint Count">
              {dashboardData.charts.siteWise?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.charts.siteWise} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={140} />
                    <Tooltip content={complaintChartTooltip} />
                    <Bar dataKey="count" radius={[0, 12, 12, 0]} fill="#b45309" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState label="No site data available." />
              )}
            </DashboardChartCard>
          </div>

          <div className="col-12">
            <DashboardChartCard title="Monthly Complaint Trend">
              {dashboardData.charts.monthlyTrend?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dashboardData.charts.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="monthLabel" />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={complaintChartTooltip} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#b91c1c"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState label="No trend data available for the selected filters." />
              )}
            </DashboardChartCard>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardChartCard({ title, children }) {
  return (
    <div className="soft-card complaint-chart-card h-100">
      <div className="complaint-chart-card__header">
        <h5 className="mb-1">{title}</h5>
      </div>
      {children}
    </div>
  );
}

function EmptyChartState({ label }) {
  return <div className="complaint-chart-empty">{label}</div>;
}

