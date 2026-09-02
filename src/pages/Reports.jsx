import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Trash2,
  Share2,
  CheckSquare,
  Square,
  X,
  Edit,
  FileText,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { listRecentReports, deleteReport } from "../lib/reportsApi";
import { reportResumeUrl } from "../lib/reportResumeUrl";
import { generateServiceReportPDF } from "../lib/generateReport";
import {
  generateSummaryPDF,
  getSummaryPDFBlobUrl,
} from "../lib/generateSummaryPDF";

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchCopied, setBatchCopied] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryPreviewUrl, setSummaryPreviewUrl] = useState(null);

  const sortedReports = [...reports].sort((a, b) => {
    const projectA = (a.templateName ?? "").toLowerCase();
    const projectB = (b.templateName ?? "").toLowerCase();
    if (projectA < projectB) return -1;
    if (projectA > projectB) return 1;
    return (b.dateOfService ?? "").localeCompare(a.dateOfService ?? "");
  });

  const filteredReports = sortedReports.filter((r) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [r.templateName, r.locationDoor, r.leadTechnician]
      .some((value) => value?.toLowerCase().includes(query));
  });

  const reportGroups = filteredReports.reduce((acc, report) => {
    const key = report.templateName || "Untitled Project";
    acc[key] = acc[key] || [];
    acc[key].push(report);
    return acc;
  }, {});

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
        ? `Padam laporan ${report.templateName}? Laporan ni dah Verified — padam tetap boleh, tapi tak boleh diundur.`
        : `Padam laporan ${report.templateName}? Tindakan ini tidak boleh diundur.`,
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

  async function handleDownload(report) {
    setDownloadingId(report.id);
    try {
      await generateServiceReportPDF(report);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert(`Gagal generate PDF: ${err.message}`);
    } finally {
      setDownloadingId(null);
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

  function handleGenerateSummary() {
    const selectedReports = reports.filter((r) => selectedIds.has(r.id));
    if (selectedReports.length === 0) {
      alert("Sila pilih sekurang-kurangnya 1 laporan.");
      return;
    }
    setGeneratingSummary(true);
    try {
      generateSummaryPDF(selectedReports, `Summary_Report_${Date.now()}.pdf`);
    } catch (err) {
      alert(`Gagal generate Summary PDF: ${err.message}`);
    } finally {
      setGeneratingSummary(false);
    }
  }

  function handlePreviewSummary() {
    const selectedReports = reports.filter((r) => selectedIds.has(r.id));
    if (selectedReports.length === 0) {
      alert("Sila pilih sekurang-kurangnya 1 laporan.");
      return;
    }
    try {
      const url = getSummaryPDFBlobUrl(selectedReports);
      setSummaryPreviewUrl(url);
    } catch (err) {
      alert(`Gagal preview Summary PDF: ${err.message}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-extrabold text-ink">All Reports</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name, location, or technician"
            className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm shadow-sm sm:w-80"
          />
          {selectMode ? (
            <button
              onClick={exitSelectMode}
              className="flex items-center gap-1 rounded-md bg-navy-800 px-3 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"
            >
              <X size={15} /> Cancel
            </button>
          ) : (
            <button
              onClick={() => setSelectMode(true)}
              className="flex items-center gap-1 rounded-md border border-navy-800 bg-white px-3 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50"
            >
              <CheckSquare size={15} /> Select multiple
            </button>
          )}
        </div>
      </div>

      {selectMode && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-50 p-4 shadow-sm">
          <div>
            <p className="text-sm font-bold text-navy-800">
              {selectedIds.size} report{selectedIds.size === 1 ? "" : "s"}{" "}
              selected
            </p>
            <p className="text-xs text-muted">
              Generate a summary PDF report or copy sign-off link for selected items.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleGenerateSummary}
              disabled={selectedIds.size === 0 || generatingSummary}
              className="flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
            >
              <FileText size={15} />
              {generatingSummary ? "Generating…" : "Generate Summary PDF"}
            </button>

            <button
              onClick={handlePreviewSummary}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-2 rounded-md border border-teal-700 bg-white px-3 py-2 text-sm font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
            >
              Preview Summary
            </button>

            <button
              onClick={handleShareBatch}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-2 rounded-md bg-navy-800 px-4 py-2 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-50"
            >
              <Share2 size={15} />{" "}
              {batchCopied ? "Link Copied ✓" : "Copy Sign-off Link"}
            </button>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading && (
          <p className="px-5 py-6 text-center text-muted">Loading…</p>
        )}
        <div className="divide-y divide-border">
          {Object.keys(reportGroups).length === 0 && !loading && (
            <p className="px-5 py-6 text-center text-muted">
              {reports.length === 0
                ? "No reports yet."
                : "No reports match your search."}
            </p>
          )}
          {Object.entries(reportGroups).map(([projectName, group]) => (
            <div key={projectName} className="border-b border-border">
              <div className="bg-surface px-5 py-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-navy-700">
                  {projectName}
                </p>
              </div>
              {group.map((r) => (
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
                <p className="font-bold text-ink">{r.templateName}</p>
                <p className="truncate text-sm text-muted">
                  {r.locationDoor} • {r.dateOfService} • {r.leadTechnician}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${
                    r.engineerSignature 
                      ? "bg-teal-50 text-teal-700 border border-teal-200" 
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    Tech: {r.engineerSignature ? "Signed ✓" : "Pending ⏳"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${
                    r.managerSignature 
                      ? "bg-teal-50 text-teal-700 border border-teal-200" 
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    Customer: {r.managerSignature ? "Signed ✓" : "Pending ⏳"}
                  </span>
                </div>
                {copiedId === r.id && (
                  <p className="text-[11px] font-semibold text-teal-600 mt-1">
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
                    onClick={() => navigate(`/checklist/${r.id}/0`)}
                    aria-label="Edit report"
                    title="Edit report"
                    className="rounded-md border border-navy-800 p-2 text-navy-800 hover:bg-navy-50"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDownload(r)}
                    disabled={downloadingId === r.id}
                    aria-label="Download PDF"
                    title="Download PDF"
                    className="rounded-md border border-navy-800 p-2 text-navy-800 hover:bg-navy-50 disabled:opacity-60"
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
          ))}
        </div>
      </section>

      {summaryPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-navy-900 text-white">
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileText size={18} /> Summary of Maintenance Work Preview
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateSummary}
                  className="flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-500"
                >
                  <Download size={14} /> Download Summary PDF
                </button>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(summaryPreviewUrl);
                    setSummaryPreviewUrl(null);
                  }}
                  className="rounded-md p-1 hover:bg-navy-800 text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-surface p-2">
              <iframe
                src={summaryPreviewUrl}
                title="Summary PDF Preview"
                className="h-full w-full rounded-md border border-border"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
