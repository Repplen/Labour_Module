import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";

const getInitial = (profile) =>
  String(profile?.employeeName || profile?.employeeCode || "?")
    .trim()
    .charAt(0)
    .toUpperCase() || "?";

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function EmployeeQrProfile() {
  const { qrToken } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [imageError, setImageError] = useState(false);
  const profilePhoto = profile?.profilePhoto || profile?.photoUrl || "";
  const isActive = String(profile?.status || "").trim().toLowerCase() === "active";
  const detailRows = useMemo(
    () => [
      { label: "Company", value: profile?.companyName },
      { label: "Designation", value: profile?.designation },
      { label: "Department", value: profile?.department },
      { label: "Date of Joining", value: formatDate(profile?.dateOfJoining) },
      { label: "Mobile Number", value: profile?.mobile },
      { label: "Status", value: profile?.status },
    ],
    [profile]
  );
  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setErrorMessage("");
      setProfile(null);

      try {
        const response = await api.get(`/employees/qr/${encodeURIComponent(qrToken || "")}`);
        if (!active) return;
        setProfile(response.data || null);
      } catch (err) {
        if (!active) return;
        setErrorMessage(
          err.response?.data?.message || "Employee not found or QR code is invalid."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [qrToken]);

  useEffect(() => {
    setImageError(false);
  }, [profilePhoto]);

  if (loading) {
    return (
      <div className="employee-qr-profile-page">
        <div className="employee-qr-profile-card employee-qr-profile-card--message">
          <div className="employee-qr-profile-loading" />
          <h1>Loading Employee Profile</h1>
          <p>Fetching the latest employee details...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !profile) {
    return (
      <div className="employee-qr-profile-page">
        <div className="employee-qr-profile-card employee-qr-profile-card--message">
          <h1>Employee QR</h1>
          <p>{errorMessage || "Employee not found or QR code is invalid."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-qr-profile-page">
      <div className="employee-qr-profile-page__wash" />
      <div className="employee-qr-profile-card">
        <div className="employee-qr-profile-card__header">
          <div className="employee-qr-profile-card__photo-shell">
            {!imageError && profilePhoto ? (
              <img
                src={profilePhoto}
                alt={profile.employeeName || "Employee"}
                className="employee-qr-profile-card__photo"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="employee-qr-profile-card__photo-fallback">
                {getInitial(profile)}
              </div>
            )}
          </div>

          <div className="employee-qr-profile-card__identity">
            <h1>{profile.employeeName || "-"}</h1>
            <div className="employee-qr-profile-card__code">
              Employee Code: {profile.employeeCode || "-"}
            </div>
          </div>

          <span
            className={`employee-qr-profile-card__status ${
              isActive
                ? "employee-qr-profile-card__status--active"
                : "employee-qr-profile-card__status--inactive"
            }`}
          >
            {profile.status || "-"}
          </span>
        </div>

        <div className="employee-qr-profile-grid">
          {detailRows.map((item) => (
            <ProfileField key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="employee-qr-profile-field">
      <div className="employee-qr-profile-field__label">{label}</div>
      <div className="employee-qr-profile-field__value">{value || "-"}</div>
    </div>
  );
}
