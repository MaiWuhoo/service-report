import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Trash2 } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { listRecentReports, deleteReport } from "../lib/reportsApi";
import { reportResumeUrl } from "../lib/reportResumeUrl";
import { generateServiceReportPDF } from "../lib/generateReport";

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    try {
      setReports(await listRecentReports(50));
    } catch {
      // Firestore not configured yet
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(report) {
    if (report.status !== "draft") return;
    const ok = window.confirm(`Padam laporan draf ${report.reportId}? Tindakan ini tidak boleh diundur.`);
    if (!ok) return;
    setDeletingId(report.id);
    try {
      await deleteReport(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (err) {
      console.error("Failed to delete report:", err);
      alert(`Gagal padam laporan: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-ink">All Reports</h2>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading && <p className="px-5 py-6 text-center text-muted">Loading…</p>}
        {!loading && reports.length === 0 && (
          <p className="px-5 py-6 text-center text-muted">No reports yet.</p>
        )}
        <div className="divide-y divide-border">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(reportResumeUrl(r))}>
                <p className="font-bold text-ink">{r.reportId}</p>
                <p className="truncate text-sm text-muted">
                  {r.locationDoor} • {r.dateOfService} • {r.leadTechnician}
                </p>
              </div>
              <StatusBadge status={r.status} />
              <button
                onClick={() => generateServiceReportPDF(r)}
                aria-label="Download PDF"
                className="rounded-md border border-navy-800 p-2 text-navy-800 hover:bg-navy-50"
              >
                <Download size={16} />
              </button>
              {r.status === "draft" && (
                <button
                  onClick={() => handleDelete(r)}
                  disabled={deletingId === r.id}
                  aria-label="Delete draft report"
                  className="rounded-md border border-danger-600 p-2 text-danger-600 hover:bg-danger-100 disabled:opacity-60"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
