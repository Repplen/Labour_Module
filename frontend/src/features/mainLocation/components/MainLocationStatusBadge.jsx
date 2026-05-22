export default function MainLocationStatusBadge({ isActive }) {
  return (
    <span className={`badge ${isActive ? "text-bg-success" : "text-bg-secondary"}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}
