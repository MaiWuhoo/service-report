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
  CalendarDays,
  Folder,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { listRecentReports, deleteReport, createShareLink, copyToClipboard, getScheduleEntry, updateReport } from "../lib/reportsApi";
import { reportResumeUrl } from "../lib/reportResumeUrl";

import { generateServiceReportPDF } from "../lib/generateReport";
import {
  generateSummaryPDF,
  getSummaryPDFBlobUrl,
  getSummaryPDFFilename,
} from "../lib/generateSummaryPDF";
import SummaryPreviewModal from "../components/SummaryPreviewModal";

function getReportDate(report) {
  if (report.dateOfService && report.dateOfService !== "-") {
    return report.dateOfService;
  }
  if (report.createdAt) {
    if (report.createdAt.toDate) {
      return report.createdAt.toDate().toISOString().slice(0, 10);
    }
    const d = new Date(report.createdAt);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return "Unknown Date";
}

function formatGroupDate(dateStr) {
  if (!dateStr || dateStr === "Unknown Date") return "No Date Set";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }); // e.g. "21 Oct 2026"
      }
    }
  } catch {}
  return dateStr;
}

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
  const [groupBy, setGroupBy] = useState("date"); // "date" | "project"
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryOrientation, setSummaryOrientation] = useState("landscape");

  const sortedReports = [...reports].sort((a, b) => {
    const dateA = getReportDate(a);
    const dateB = getReportDate(b);
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA); // Newest date first
    }
    const projectA = (a.templateName ?? "").toLowerCase();
    const projectB = (b.templateName ?? "").toLowerCase();
    return projectA.localeCompare(projectB);
  });

  const filteredReports = sortedReports.filter((r) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [r.templateName, r.locationDoor, r.leadTechnician, r.dateOfService]
      .some((value) => value?.toLowerCase().includes(query));
  });

  const reportGroups = new Map();
  for (const report of filteredReports) {
    let key;
    if (groupBy === "project") {
      key = report.templateName || "Untitled Project";
    } else {
      const rawDate = getReportDate(report);
      key = rawDate !== "Unknown Date" ? formatGroupDate(rawDate) : "No Date Set";
    }
    if (!reportGroups.has(key)) {
      reportGroups.set(key, []);
    }
    reportGroups.get(key).push(report);
  }

  async function load() {
    try {
      const fetched = await listRecentReports(100);
      setReports(fetched);

      // Auto-sync reports whose schedule has updated technician or location
      const reportsWithSchedule = fetched.filter((r) => r.scheduleId);
      if (reportsWithSchedule.length > 0) {
        const scheduleIds = [...new Set(reportsWithSchedule.map((r) => r.scheduleId))];
        const scheduleEntries = await Promise.all(
          scheduleIds.map(async (sId) => {
            try {
              return await getScheduleEntry(sId);
            } catch {
              return null;
            }
          })
        );
        const scheduleMap = new Map();
        scheduleEntries.filter(Boolean).forEach((s) => scheduleMap.set(s.id, s));

        let hadUpdates = false;
        const updatedReports = await Promise.all(
          fetched.map(async (r) => {
            if (!r.scheduleId) return r;
            const sched = scheduleMap.get(r.scheduleId);
            if (!sched) return r;

            const sel = Array.isArray(sched.templateSelections)
              ? sched.templateSelections.find((s) => s.reportId === r.id || s.templateId === r.templateId)
              : null;

            const targetTech = (sched.assignedTechnician ?? "").trim();
            const targetLoc = (sel?.location?.trim() || sched.location?.trim() || "").trim();

            const patch = {};
            if (targetTech && targetTech !== "Unassigned" && r.leadTechnician !== targetTech) {
              patch.leadTechnician = targetTech;
            }
            if (targetLoc && targetLoc !== "-" && r.locationDoor !== targetLoc) {
              patch.locationDoor = targetLoc;
            }

            if (Object.keys(patch).length > 0) {
              hadUpdates = true;
              try {
                await updateReport(r.id, patch);
                return { ...r, ...patch };
              } catch (e) {
                console.error("Error auto-syncing report in Reports:", e);
              }
            }
            return r;
          })
        );

        if (hadUpdates) {
          setReports(updatedReports);
        }
      }
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
    try {
      const token = await createShareLink([report.id], "single");
      const url = `${window.location.origin}/s/${token}`;
      await copyToClipboard(url);
      setCopiedId(report.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("handleShare error:", err);
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
    try {
      const token = await createShareLink(ids, "batch");
      const url = `${window.location.origin}/s/${token}`;
      await copyToClipboard(url);
      setBatchCopied(true);
      setTimeout(() => setBatchCopied(false), 2500);
    } catch (err) {
      console.error("handleShareBatch error:", err);
    }
  }

  function handleOpenSummary() {
    const selectedReports = reports.filter((r) => selectedIds.has(r.id));
    if (selectedReports.length === 0) {
      alert("Sila pilih sekurang-kurangnya 1 laporan.");
      return;
    }
    setShowSummaryModal(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-extrabold text-ink">All Reports</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center rounded-lg border border-border bg-white p-0.5 shadow-2xs text-xs font-semibold">
            <button
              type="button"
              onClick={() => setGroupBy("date")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition cursor-pointer ${
                groupBy === "date"
                  ? "bg-navy-800 text-white font-bold shadow-xs"
                  : "text-muted hover:text-ink hover:bg-slate-100"
              }`}
            >
              <CalendarDays size={14} /> By Date
            </button>
            <button
              type="button"
              onClick={() => setGroupBy("project")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition cursor-pointer ${
                groupBy === "project"
                  ? "bg-navy-800 text-white font-bold shadow-xs"
                  : "text-muted hover:text-ink hover:bg-slate-100"
              }`}
            >
              <Folder size={14} /> By Project
            </button>
          </div>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project, location, tech, or date"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm sm:w-72"
          />
          {selectMode ? (
            <button
              onClick={exitSelectMode}
              className="flex items-center gap-1 rounded-md bg-navy-800 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-700 cursor-pointer"
            >
              <X size={15} /> Cancel
            </button>
          ) : (
            <button
              onClick={() => setSelectMode(true)}
              className="flex items-center gap-1 rounded-md border border-navy-800 bg-white px-3 py-2 text-sm font-semibold text-navy-700 hover:bg-navy-50 cursor-pointer"
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-teal-700/40 bg-white p-0.5 shadow-xs text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSummaryOrientation("landscape")}
                className={`px-2.5 py-1.5 rounded-md transition ${
                  summaryOrientation === "landscape"
                    ? "bg-teal-700 text-white shadow-xs font-bold"
                    : "text-ink/70 hover:text-ink hover:bg-slate-100"
                }`}
                title="Landscape (Horizontal)"
              >
                Landscape
              </button>
              <button
                type="button"
                onClick={() => setSummaryOrientation("portrait")}
                className={`px-2.5 py-1.5 rounded-md transition ${
                  summaryOrientation === "portrait"
                    ? "bg-teal-700 text-white shadow-xs font-bold"
                    : "text-ink/70 hover:text-ink hover:bg-slate-100"
                }`}
                title="Portrait (Vertical)"
              >
                Portrait
              </button>
            </div>

            <button
              onClick={handleOpenSummary}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 transition"
            >
              <FileText size={16} /> View & Download Summary
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
          {reportGroups.size === 0 && !loading && (
            <p className="px-5 py-6 text-center text-muted">
              {reports.length === 0
                ? "No reports yet."
                : "No reports match your search."}
            </p>
          )}
          {Array.from(reportGroups.entries()).map(([groupName, group]) => (
            <div key={groupName} className="border-b border-border">
              <div className="bg-surface px-5 py-3 flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-navy-700 flex items-center gap-2">
                  {groupBy === "date" ? (
                    <CalendarDays size={16} className="text-navy-700" />
                  ) : (
                    <Folder size={16} className="text-navy-700" />
                  )}
                  {groupName}
                </p>
                <span className="text-xs font-semibold text-muted bg-white px-2.5 py-0.5 rounded-full border border-border shadow-2xs">
                  {group.length} {group.length === 1 ? "report" : "reports"}
                </span>
              </div>
              {group.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/60 transition"
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
                      {r.locationDoor?.trim() || "-"} • {r.dateOfService || "-"} • {r.leadTechnician?.trim() || "Unassigned"}
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
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleShare(r)}
                        aria-label="Copy customer sign-off link"
                        title="Copy customer sign-off link"
                        className="rounded-md border border-navy-800 p-2 text-navy-800 hover:bg-navy-50"
                      >
                        <Share2 size={16} />
                      </button>
                      <button
                        onClick={() => navigate(reportResumeUrl(r))}
                        aria-label="Open report"
                        title="Open report"
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {showSummaryModal && (
        <SummaryPreviewModal
          reports={reports.filter((r) => selectedIds.has(r.id))}
          onClose={() => setShowSummaryModal(false)}
          initialOrientation={summaryOrientation}
        />
      )}
    </div>
  );
}
