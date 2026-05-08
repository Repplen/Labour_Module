import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";

const getInitial = (profile) =>
  String(profile?.employeeName || profile?.employeeCode || "?")
    .trim()
    .charAt(0)
    .toUpperCase() || "?";

export default function EmployeeQrProfile() {
  const { qrToken } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [imageError, setImageError] = useState(false);
  const statusClass = profile?.isActive ? "bg-success" : "bg-secondary";
  const updatedLabel = useMemo(() => {
    if (!profile?.lastUpdatedAt) return "";

    const date = new Date(profile.lastUpdatedAt);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString();
  }, [profile?.lastUpdatedAt]);

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

  if (loading) {
    return (
      <div className="employee-qr-profile-page">
        <div className="employee-qr-profile-card">Loading employee profile...</div>
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
      <div className="employee-qr-profile-card">
        <div className="employee-qr-profile-card__header">
          {!imageError && profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt={profile.employeeName || "Employee"}
              className="employee-qr-profile-card__photo"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="employee-qr-profile-card__photo-fallback">
              {getInitial(profile)}
            </div>
          )}

          <div>
            <div className="employee-qr-profile-card__kicker">Employee Profile</div>
            <h1>{profile.employeeName || "-"}</h1>
            <div className="employee-qr-profile-card__code">
              {profile.employeeCode || "Employee code not available"}
            </div>
            <span className={`badge ${statusClass}`}>{profile.status}</span>
          </div>
        </div>

        <div className="employee-qr-profile-grid">
          <ProfileField label="Designation" value={profile.designation} />
          <ProfileField label="Company" value={profile.company} />
          <ProfileField label="Department" value={profile.department} />
          <ProfileField label="Sub Department" value={profile.subDepartment} />
          <ProfileField label="Site" value={profile.site} />
          <ProfileField label="Status" value={profile.status} />
        </div>

        {updatedLabel ? (
          <div className="employee-qr-profile-card__updated">
            Latest profile update: {updatedLabel}
          </div>
        ) : null}
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
