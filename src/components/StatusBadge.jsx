const styles = {
  verified: "bg-teal-100 text-teal-600",
  in_review: "bg-danger-100 text-danger-600",
  in_progress: "bg-navy-50 text-navy-700",
  upcoming: "bg-teal-100 text-teal-600",
  draft: "bg-navy-50 text-navy-600",
};

const labels = {
  verified: "Verified",
  in_review: "In Review",
  in_progress: "In Progress",
  upcoming: "Upcoming",
  draft: "Draft",
};

export default function StatusBadge({ status = "draft" }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] ?? styles.draft
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
