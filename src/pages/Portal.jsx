import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  History,
  CalendarDays,
  Info,
  Headset,
  Plus,
  CalendarPlus,
  Trash2,
  Share2,
  Pencil,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import {
  listRecentReports,
  listUpcomingSchedule,
  deleteReport,
  listChecklistTemplates,
  listCustomers,
  getReport,
  updateScheduleEntry,
  createShareLink,
  copyToClipboard,
} from "../lib/reportsApi";
import { createReportFromTemplate } from "../lib/createReportFromTemplate";
import { reportResumeUrl } from "../lib/reportResumeUrl";
import { DEFAULT_TEMPLATE } from "../lib/defaultTemplates";
import ConfirmDialog from "../components/ConfirmDialog";

export default function Portal() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([DEFAULT_TEMPLATE]);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE.id);
  const [locationDoor, setLocationDoor] = useState("");
  const [technician, setTechnician] = useState("");
  const [dateOfService, setDateOfService] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [recentReports, setRecentReports] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQuickSchedule, setShowQuickSchedule] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openingScheduleId, setOpeningScheduleId] = useState(null);

  async function handleScheduleClick(entry) {
    // If this schedule entry has explicit templateSelections, show the list
    // of form instances we created so the user can pick one.
    setOpeningScheduleId(entry.id);
    try {
      if (entry.templateSelections && entry.templateSelections.length > 0) {
        navigate(`/schedule/${entry.id}/open`);
        return;
      }

      // Already has a report linked — resume it instead of creating a new one.
      if (entry.reportId) {
        const existing = await getReport(entry.reportId);
        if (existing) {
          navigate(reportResumeUrl(existing));
          return;
        }
      }

      // No selections — fallback to the old single-template behavior.
      const templateId = entry.templateIds?.[0] ?? entry.templateId;
      const template =
        templates.find((t) => t.id === templateId) ?? DEFAULT_TEMPLATE;
      const newId = await createReportFromTemplate(template, {
        locationDoor: entry.location,
        leadTechnician: entry.assignedTechnician,
        customerId: entry.customerId || undefined,
        dateOfService: entry.startDate,
        scheduleId: entry.id,
      });
      await updateScheduleEntry(entry.id, {
        reportId: newId,
        status: "in_progress",
      });
      setSchedule((prev) =>
        prev.map((s) =>
          s.id === entry.id
            ? { ...s, reportId: newId, status: "in_progress" }
            : s,
        ),
      );
      navigate(`/checklist/${newId}/0`);
    } catch (err) {
      console.error("Failed to open scheduled checklist:", err);
      alert(`Gagal buka checklist: ${err.message}`);
    } finally {
      setOpeningScheduleId(null);
    }
  }

  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [reports, upcoming, customTemplates, customerList] =
          await Promise.all([
            listRecentReports(4),
            listUpcomingSchedule(),
            listChecklistTemplates(),
            listCustomers(),
          ]);
        setRecentReports(reports);
        setSchedule(upcoming);
        setTemplates([DEFAULT_TEMPLATE, ...customTemplates]);
        setCustomers(customerList);
      } catch {
        // Firestore not configured yet — page still renders with empty state
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedTemplate =
    templates.find((t) => t.id === templateId) ?? DEFAULT_TEMPLATE;

  function handleTemplateChange(id) {
    setTemplateId(id);
    const t = templates.find((tpl) => tpl.id === id);
    if (t?.locationDoor) setLocationDoor(t.locationDoor);
    if (t?.assignedTechnician && !technician)
      setTechnician(t.assignedTechnician);
  }

  const [confirmDeleteReport, setConfirmDeleteReport] = useState(null);

  function handleDeleteReport(e, report) {
    e.stopPropagation();
    setConfirmDeleteReport(report);
  }

  async function performDeleteReport() {
    const report = confirmDeleteReport;
    if (!report) return;
    setConfirmDeleteReport(null);
    setDeletingId(report.id);
    try {
      await deleteReport(report.id);
      setRecentReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (err) {
      console.error("Failed to delete report:", err);
      alert(`Gagal padam laporan: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  const [copiedShareId, setCopiedShareId] = useState(null);

  async function handleShareReport(e, report) {
    e.stopPropagation();
    try {
      const token = await createShareLink([report.id], "single");
      const url = `${window.location.origin}/s/${token}`;
      await copyToClipboard(url);
      setCopiedShareId(report.id);
      setTimeout(() => setCopiedShareId(null), 2000);
    } catch (err) {
      console.error("handleShareReport error:", err);
    }
  }

  async function handleNewReport() {
    setCreating(true);
    try {
      const id = await createReportFromTemplate(selectedTemplate, {
        locationDoor,
        leadTechnician: technician,
        customerId: customerId || undefined,
        dateOfService,
      });
      navigate(`/checklist/${id}/0`);
    } catch (err) {
      console.error("Failed to create report:", err);
      alert(`Gagal buat laporan baru: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Intro + form card */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
        <h2 className="text-2xl font-extrabold text-navy-800">
          Maintenance Portal
        </h2>
        <p className="mt-1 text-sm text-muted">
          Initialize a new Preventive Maintenance Service Report or track the
          status of existing technical documentations for Terminal Facilities.
        </p>

        <div className="mt-5 rounded-lg border border-border bg-surface p-4">
          <div className="grid gap-4 md:grid-cols-[1.6fr_1fr_1fr]">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Checklist Template
              </label>
              <select
                value={templateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {/* <p className="mt-1 text-xs text-muted">
                {selectedTemplate.sections?.length ?? 0} section(s) —{" "}
                <button
                  type="button"
                  onClick={() => navigate("/checklist-templates/new")}
                  className="font-semibold text-navy-700 hover:underline"
                >
                  manage templates
                </button>
              </p> */}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Location Door
              </label>
              <input
                value={locationDoor}
                onChange={(e) => setLocationDoor(e.target.value)}
                placeholder="e.g. Gate 3 - Cargo Bay"
                className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Customer
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm"
              >
                <option value="">— No customer / general —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {/* <p className="mt-1 text-xs text-muted">
                <button
                  type="button"
                  onClick={() => navigate("/customers/new")}
                  className="font-semibold text-navy-700 hover:underline"
                >
                  + new customer
                </button>
              </p> */}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Lead Technician
              </label>
              <input
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                placeholder="Enter full name"
                className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Inspection Date
              </label>
              <input
                type="date"
                value={dateOfService}
                onChange={(e) => setDateOfService(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <button
              onClick={handleNewReport}
              disabled={creating}
              className="flex items-center justify-center gap-2 rounded-md bg-navy-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-60"
            >
              <Plus size={16} /> {creating ? "Creating…" : "New Service Report"}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowQuickSchedule((s) => !s)}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-navy-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-navy-700"
              >
                <CalendarPlus size={16} /> Schedule Next Maintenance
              </button>
              {showQuickSchedule && (
                <div className="absolute right-0 z-10 mt-2 w-48 rounded-md border border-border bg-white p-2 shadow-lg">
                  <button
                    onClick={() => navigate("/schedule")}
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-surface"
                  >
                    <CalendarDays size={16} /> Next Available Slot
                  </button>
                  <button
                    onClick={() => navigate("/schedule")}
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-surface"
                  >
                    <CalendarDays size={16} /> Custom Date...
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Recent reports */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-navy-800">
            <History size={18} /> Recent Reports
          </h3>
          <button
            onClick={() => navigate("/reports")}
            className="text-sm font-semibold text-navy-700 hover:underline"
          >
            View All Records
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-surface text-left text-xs font-semibold uppercase text-muted">
                <th className="px-5 py-3">Project Name</th>
                <th className="px-5 py-3">Inspection Date</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Technician</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && recentReports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-muted">
                    No reports yet — create your first one above.
                  </td>
                </tr>
              )}
              {recentReports.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(reportResumeUrl(r))}
                  className="cursor-pointer border-t border-border hover:bg-surface"
                >
                  <td className="px-5 py-3.5 font-medium">{r.templateName}</td>
                  <td className="px-5 py-3.5">{r.dateOfService}</td>
                  <td className="px-5 py-3.5">{r.locationDoor}</td>
                  <td className="px-5 py-3.5">{r.leadTechnician}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={(e) => handleShareReport(e, r)}
                        aria-label="Copy customer sign-off link"
                        title="Copy customer sign-off link"
                        className="rounded-md border border-navy-800 p-1.5 text-navy-800 hover:bg-navy-50"
                      >
                        <Share2 size={15} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteReport(e, r)}
                        disabled={deletingId === r.id}
                        aria-label="Delete report"
                        title="Delete report"
                        className="rounded-md border border-danger-600 p-1.5 text-danger-600 hover:bg-danger-100 disabled:opacity-60"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {copiedShareId === r.id && (
                      <p className="mt-1 text-[11px] font-semibold text-teal-600">
                        Link copied ✓
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Maintenance schedule */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-navy-800">
            <CalendarDays size={18} /> Maintenance Schedule
          </h3>
          <button
            onClick={() => navigate("/calendar")}
            className="text-sm font-semibold text-navy-700 hover:underline"
          >
            Full Calendar
          </button>
        </div>
        <div className="divide-y divide-border">
          {schedule.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-muted">
              No upcoming maintenance scheduled.
            </p>
          )}
          {schedule.map((s) => (
            <div
              key={s.id}
              onClick={() => handleScheduleClick(s)}
              className="flex cursor-pointer items-center gap-4 px-5 py-4 hover:bg-surface"
            >
              <div className="w-14 shrink-0 text-center">
                <div className="text-xs font-bold uppercase text-navy-700">
                  {s.monthLabel}
                </div>
                <div className="text-xl font-extrabold text-ink">
                  {s.dayLabel}
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-ink">{s.title}</p>
                <p className="text-sm text-muted">{s.location}</p>
                {s.durationDays > 1 && (
                  <p className="text-xs text-navy-700">
                    {s.startDate} → {s.endDate} ({s.durationDays} days)
                  </p>
                )}
                {s.templateName && (
                  <p className="text-xs text-muted">
                    Checklist: {s.templateName}
                  </p>
                )}
              </div>
              <StatusBadge status={(() => {
                if (s.templateSelections && s.templateSelections.length > 0) {
                  const statuses = s.templateSelections.map((sel) => sel.status ?? "upcoming");
                  if (statuses.length > 0 && statuses.every((st) => st === "verified")) {
                    return "verified";
                  }
                  if (statuses.some((st) => st === "verified" || st === "in_progress")) {
                    return "in_progress";
                  }
                  return "upcoming";
                }
                return s.status ?? "upcoming";
              })()} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/schedule/${s.id}/edit`);
                }}
                aria-label="Edit schedule"
                title="Edit schedule"
                className="rounded-md border border-navy-800 p-1.5 text-navy-800 hover:bg-navy-50"
              >
                <Pencil size={14} />
              </button>
              {openingScheduleId === s.id ? (
                <span className="text-xs font-semibold text-navy-700">
                  Opening…
                </span>
              ) : (
                <CalendarDays className="text-navy-700" size={20} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer info cards */}
      {/* <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h4 className="flex items-center gap-2 text-sm font-bold text-navy-800">
            <Info size={16} /> Service Protocol
          </h4>
          <p className="mt-2 text-sm text-muted">
            Ensure all diagnostic tests for biometric sensors and
            electromagnetic locks are documented with photographic evidence for
            critical faults. Failure to record software versions will result in
            report rejection.
          </p>
        </section>
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h4 className="flex items-center gap-2 text-sm font-bold text-navy-800">
            <Headset size={16} /> Support &amp; Guidance
          </h4>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Technician assistance available 24/7 via the internal channel.
            </p>
            <button className="shrink-0 rounded-md border border-navy-800 px-3 py-2 text-xs font-bold text-navy-800 hover:bg-navy-50">
              Open Wiki
            </button>
          </div>
        </section>
      </div> */}

      <ConfirmDialog
        open={Boolean(confirmDeleteReport)}
        title={`Padam laporan ${confirmDeleteReport?.reportId ?? ""}?`}
        message={
          confirmDeleteReport?.status === "verified"
            ? "Laporan ni dah Verified — padam tetap boleh, tapi tak boleh diundur."
            : "Tindakan ini tidak boleh diundur."
        }
        confirmLabel="Padam"
        onConfirm={performDeleteReport}
        onCancel={() => setConfirmDeleteReport(null)}
      />
    </div>
  );
}
