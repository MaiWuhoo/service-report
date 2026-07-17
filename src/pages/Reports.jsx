import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Trash2, Share2, CheckSquare, Square, X } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { listRecentReports, deleteReport } from "../lib/reportsApi";
import { reportResumeUrl } from "../lib/reportResumeUrl";
import { generateServiceReportPDF } from "../lib/generateReport";

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchCopied, setBatchCopied] = useState(false);

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
    const ok = window.confirm(
      report.status === "verified"
        ? `Padam laporan ${report.reportId}? Laporan ni dah Verified — padam tetap boleh, tapi tak boleh diundur.`
        : `Padam laporan ${report.reportId}? Tindakan ini tidak boleh diundur.`,
    );
    if (!ok) return;
    setDeletingId(report.id);
    try {
      await deleteReport(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(report.id);
        return next;
      });
    } catch (err) {
      console.error("Failed to delete report:", err);
      alert(`Gagal padam laporan: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleShare(report) {
    const url = `${window.location.origin}/sign/${report.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(report.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function handleShareBatch() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const url = `${window.location.origin}/sign-batch/${ids.join(",")}`;
    try {
      await navigator.clipboard.writeText(url);
      setBatchCopied(true);
      setTimeout(() => setBatchCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-ink">All Reports</h2>
        {selectMode ? (
          <button
            onClick={exitSelectMode}
            className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
          >
            <X size={15} /> Cancel
          </button>
        ) : (
          <button
            onClick={() => setSelectMode(true)}
            className="flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline"
          >
            <CheckSquare size={15} /> Select multiple
          </button>
        )}
      </div>

      {selectMode && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-50 p-4">
          <p className="text-sm font-semibold text-navy-800">
            {selectedIds.size} report{selectedIds.size === 1 ? "" : "s"}{" "}
            selected
          </p>
          <button
            onClick={handleShareBatch}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 rounded-md bg-navy-800 px-4 py-2 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            <Share2 size={15} />{" "}
            {batchCopied
              ? "Link Copied ✓"
              : `Share ${selectedIds.size || ""} Report${selectedIds.size === 1 ? "" : "s"} in One Link`}
          </button>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading && (
          <p className="px-5 py-6 text-center text-muted">Loading…</p>
        )}
        {!loading && reports.length === 0 && (
          <p className="px-5 py-6 text-center text-muted">No reports yet.</p>
        )}
        <div className="divide-y divide-border">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 px-5 py-4"
            >
              {selectMode && (
                <button
                  onClick={() => toggleSelect(r.id)}
                  aria-label={
                    selectedIds.has(r.id) ? "Deselect report" : "Select report"
                  }
                  className="shrink-0 text-navy-800"
                >
                  {selectedIds.has(r.id) ? (
                    <CheckSquare size={20} />
                  ) : (
                    <Square size={20} />
                  )}
                </button>
              )}
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() =>
                  selectMode ? toggleSelect(r.id) : navigate(reportResumeUrl(r))
                }
              >
                <p className="font-bold text-ink">{r.reportId}</p>
                <p className="truncate text-sm text-muted">
                  {r.locationDoor} • {r.dateOfService} • {r.leadTechnician}
                </p>
                {copiedId === r.id && (
                  <p className="text-[11px] font-semibold text-teal-600">
                    Link copied ✓
                  </p>
                )}
              </div>
              <StatusBadge status={r.status} />
              {!selectMode && (
                <>
                  <button
                    onClick={() => handleShare(r)}
                    aria-label="Copy customer sign-off link"
                    title="Copy customer sign-off link"
                    className="rounded-md border border-navy-800 p-2 text-navy-800 hover:bg-navy-50"
                  >
                    <Share2 size={16} />
                  </button>
                  <button
                    onClick={() => generateServiceReportPDF(r)}
                    aria-label="Download PDF"
                    title="Download PDF"
                    className="rounded-md border border-navy-800 p-2 text-navy-800 hover:bg-navy-50"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={deletingId === r.id}
                    aria-label="Delete report"
                    title="Delete report"
                    className="rounded-md border border-danger-600 p-2 text-danger-600 hover:bg-danger-100 disabled:opacity-60"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
