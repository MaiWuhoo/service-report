import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays, Trash2 } from "lucide-react";
import {
  createScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
  getScheduleEntry,
  listChecklistTemplates,
  listCustomers,
  listAllSchedule,
  getCompanyProfile,
} from "../lib/reportsApi";
import { DEFAULT_TEMPLATE } from "../lib/defaultTemplates";
import ConfirmDialog from "../components/ConfirmDialog";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function fmt(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayCount(start, end) {
  const ms = end.setHours(0, 0, 0, 0) - new Date(start).setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

/** Builds a local-time Date from a YYYY-MM-DD string without any timezone
 *  shift (new Date("2026-07-27") parses as UTC and can land on the wrong
 *  local day). */
function parseDateStr(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateInput(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function ScheduleMaintenance() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  function createSelection(templateId, location = "") {
    return {
      id: `${templateId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      templateId,
      location,
    };
  }

  const [step, setStep] = useState(isEditing ? 2 : 1);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    setStep(isEditing ? 2 : 1);
  }, [isEditing]);

  // Range selection state
  const [rangeStart, setRangeStart] = useState(today);
  const [rangeEnd, setRangeEnd] = useState(null);

  const [maintenanceName, setMaintenanceName] = useState(
    "Quarterly Access Door Service",
  );
  const [technician, setTechnician] = useState("");
  const [locationDoor, setLocationDoor] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [confirming, setConfirming] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(isEditing);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [templates, setTemplates] = useState([DEFAULT_TEMPLATE]);
  const [templateSelections, setTemplateSelections] = useState([
    createSelection(DEFAULT_TEMPLATE.id),
  ]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [existingSchedules, setExistingSchedules] = useState([]);
  const [companyStamp, setCompanyStamp] = useState(null);
  const [includeCompanyStamp, setIncludeCompanyStamp] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const custom = await listChecklistTemplates();
        setTemplates([DEFAULT_TEMPLATE, ...custom]);
      } catch {
        // Firestore not reachable yet — fall back to the built-in template only
      }
      try {
        setCustomers(await listCustomers());
      } catch {
        // Firestore not reachable yet
      }

      if (isEditing) {
        const entry = await getScheduleEntry(id);
        if (entry) {
          setMaintenanceName(entry.title ?? "Quarterly Access Door Service");
          setLocationDoor(entry.location ?? "");
          setTechnician(entry.assignedTechnician ?? "");
          setPriority(entry.priority ?? "Medium");
          setTemplateSelections(
            (entry.templateSelections ??
              (entry.templateIds
                ? entry.templateIds.map((templateId) => ({
                    id: `${templateId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    templateId,
                    formCount: 1,
                    location: entry.location ?? "",
                  }))
                : entry.templateId
                ? [
                    {
                      id: `${entry.templateId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      templateId: entry.templateId,
                      formCount: 1,
                      location: entry.location ?? "",
                    },
                  ]
                : [
                    {
                      id: `${DEFAULT_TEMPLATE.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      templateId: DEFAULT_TEMPLATE.id,
                      formCount: 1,
                      location: entry.location ?? "",
                    },
                  ]))
              .map((sel) => ({
                id: sel.id ?? createSelection(sel.templateId, sel.location ?? entry.location ?? "").id,
                templateId: sel.templateId,
                formCount: sel.formCount ?? 1,
                location: sel.location ?? entry.location ?? "",
              })),
          );
          setCustomerId(entry.customerId ?? "");
          setCompanyStamp(entry.companyStamp ?? null);
          setIncludeCompanyStamp(Boolean(entry.companyStamp));
          const start = parseDateStr(entry.startDate) ?? today;
          const end = parseDateStr(entry.endDate);
          setRangeStart(start);
          setRangeEnd(end && end.getTime() !== start.getTime() ? end : null);
          setViewYear(start.getFullYear());
          setViewMonth(start.getMonth());
        }
        setLoadingEntry(false);
      }
      try {
        const allSchedules = await listAllSchedule();
        setExistingSchedules(allSchedules);
      } catch {
        // ignore schedule-loading failures
      }

      try {
        const profile = await getCompanyProfile();
        const stamp = profile?.companyStamp ?? null;
        setCompanyStamp(stamp);
        setIncludeCompanyStamp(Boolean(stamp));
      } catch {
        // ignore profile-loading failures
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cells = buildMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    if (!rangeStart) return;
    setViewYear(rangeStart.getFullYear());
    setViewMonth(rangeStart.getMonth());
  }, [rangeStart]);

  function changeMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  function pickDay(d) {
    const clicked = new Date(viewYear, viewMonth, d);
    if (!rangeStart || rangeEnd) {
      // start a fresh selection
      setRangeStart(clicked);
      setRangeEnd(null);
      return;
    }
    // rangeStart set, no end yet
    if (clicked < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(clicked);
    } else {
      setRangeEnd(clicked);
    }
  }

  function isInRange(d) {
    if (!rangeStart) return false;
    const day = new Date(viewYear, viewMonth, d).getTime();
    const start = new Date(rangeStart).setHours(0, 0, 0, 0);
    const end = rangeEnd ? new Date(rangeEnd).setHours(0, 0, 0, 0) : start;
    return day >= start && day <= end;
  }

  function isEndpoint(d) {
    const day = new Date(viewYear, viewMonth, d).getTime();
    const start = rangeStart ? new Date(rangeStart).setHours(0, 0, 0, 0) : null;
    const end = rangeEnd ? new Date(rangeEnd).setHours(0, 0, 0, 0) : null;
    return day === start || day === end;
  }

  const effectiveEnd = rangeEnd ?? rangeStart;
  const totalDays = rangeStart
    ? dayCount(rangeStart, new Date(effectiveEnd))
    : 0;

  const selectedTemplateIds = Array.from(
    new Set(templateSelections.map((selection) => selection.templateId)),
  );
  const selectedTemplates = templates.filter((t) =>
    selectedTemplateIds.includes(t.id),
  );

  function scheduleIsCurrent(entry) {
    return isEditing && entry.id === id;
  }

  function getNearbySchedules() {
    if (!rangeStart) {
      return {
        earlier: existingSchedules
          .filter((entry) => !scheduleIsCurrent(entry))
          .slice(0, 3),
        later: [],
      };
    }

    const startKey = formatDateInput(rangeStart);
    const endKey = formatDateInput(rangeEnd ?? rangeStart);
    const earlier = [];
    const later = [];

    for (const entry of existingSchedules) {
      if (scheduleIsCurrent(entry)) continue;
      if (entry.endDate < startKey) {
        earlier.push(entry);
      } else if (entry.startDate > endKey) {
        later.push(entry);
      }
    }

    earlier.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
    later.sort((a, b) => (a.startDate > b.startDate ? 1 : -1));

    return {
      earlier: earlier.slice(0, 3),
      later: later.slice(0, 3),
    };
  }

  function fmtScheduleEntry(entry) {
    return `${entry.startDate} → ${entry.endDate}${entry.title ? ` · ${entry.title}` : ""}`;
  }

  function toggleTemplateSelection(templateId) {
    setTemplateSelections((prev) =>
      prev.some((selection) => selection.templateId === templateId)
        ? prev.filter((selection) => selection.templateId !== templateId)
        : [...prev, createSelection(templateId, locationDoor || "")],
    );
  }

  function updateTemplateSelection(instanceId, patch) {
    setTemplateSelections((prev) =>
      prev.map((selection) =>
        selection.id === instanceId ? { ...selection, ...patch } : selection,
      ),
    );
  }

  function setTemplateCount(templateId, count) {
    setTemplateSelections((prev) => {
      const normalizedCount = Math.max(1, count);
      // Preserve overall order. Adjust only the group for the given templateId.
      const result = [];
      let group = [];
      let sawTemplate = false;
      for (const sel of prev) {
        if (sel.templateId === templateId) {
          group.push(sel);
          sawTemplate = true;
        } else {
          if (group.length) {
            if (group.length >= normalizedCount) {
              result.push(...group.slice(0, normalizedCount));
            } else {
              result.push(...group);
              const additions = Array.from({ length: normalizedCount - group.length }, () =>
                createSelection(templateId, group[0]?.location || locationDoor || ""),
              );
              result.push(...additions);
            }
            group = [];
          }
          result.push(sel);
        }
      }

      if (group.length) {
        if (group.length >= normalizedCount) {
          result.push(...group.slice(0, normalizedCount));
        } else {
          result.push(...group);
          const additions = Array.from({ length: normalizedCount - group.length }, () =>
            createSelection(templateId, group[0]?.location || locationDoor || ""),
          );
          result.push(...additions);
        }
      }

      if (!sawTemplate) {
        // template wasn't present before — add instances at the end
        const additions = Array.from({ length: normalizedCount }, () =>
          createSelection(templateId, locationDoor || ""),
        );
        result.push(...additions);
      }

      return result;
    });
  }

  function removeTemplateInstance(instanceId) {
    setTemplateSelections((prev) =>
      prev.filter((selection) => selection.id !== instanceId),
    );
  }

  async function confirmSchedule() {
    setConfirming(true);
    try {
      const primaryTemplate =
        selectedTemplates[0] ??
        templates.find((t) => t.id === selectedTemplateIds[0]) ??
        DEFAULT_TEMPLATE;
      const payload = {
        title: maintenanceName,
        location: locationDoor,
        startDate: formatDateInput(rangeStart),
        endDate: formatDateInput(effectiveEnd),
        monthLabel: rangeStart
          .toLocaleString("en-US", { month: "short" })
          .toUpperCase(),
        dayLabel: rangeStart.getDate(),
        durationDays: totalDays,
        assignedTechnician: technician,
        priority,
        templateSelections: templateSelections,
        templateIds:
          selectedTemplateIds.length > 0
            ? selectedTemplateIds
            : [primaryTemplate.id],
        templateNames:
          selectedTemplates.length > 0
            ? selectedTemplates.map((t) => t.name)
            : [primaryTemplate.name],
        templateId: primaryTemplate.id,
        templateName: primaryTemplate.name,
        customerId: customerId || null,
        companyStamp: includeCompanyStamp ? companyStamp : null,
      };

      if (isEditing) {
        await updateScheduleEntry(id, payload);
      } else {
        await createScheduleEntry({ ...payload, status: "upcoming" });
      }
      navigate("/");
    } catch (err) {
      console.error("Failed to save schedule:", err);
      alert(`Gagal simpan jadual: ${err.message}`);
    } finally {
      setConfirming(false);
    }
  }

  async function performCancelSchedule() {
    setConfirmCancel(false);
    setCancelling(true);
    try {
      await deleteScheduleEntry(id);
      navigate("/");
    } catch (err) {
      console.error("Failed to cancel schedule:", err);
      alert(`Gagal cancel jadual: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  }

  if (loadingEntry) {
    return <p className="py-10 text-center text-muted">Loading…</p>;
  }

  if (step === 1) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-extrabold text-ink">
            {isEditing
              ? "Edit Maintenance Date Range"
              : "Select Maintenance Date Range"}
          </h2>
          <p className="text-sm text-muted">
            Tap a start date, then an end date to schedule a multi-day
            inspection window.
          </p>
        </div>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-bold text-ink">{monthLabel}</p>
            <div className="flex gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="rounded p-1 hover:bg-surface"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => changeMonth(1)}
                className="rounded p-1 hover:bg-surface"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const inRange = isInRange(d);
              const endpoint = isEndpoint(d);
              const isToday =
                today.getDate() === d &&
                today.getMonth() === viewMonth &&
                today.getFullYear() === viewYear;
              return (
                <button
                  key={i}
                  onClick={() => pickDay(d)}
                  className={`aspect-square rounded-md text-sm font-medium transition-colors ${
                    endpoint
                      ? "bg-navy-800 text-white"
                      : inRange
                        ? "bg-navy-50 text-navy-800"
                        : isToday
                          ? "border border-navy-800"
                          : "hover:bg-surface"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">
                Nearby Scheduled Maintenance
              </p>
              <p className="text-sm text-ink">
                Existing bookings before and after your selected dates.
              </p>
            </div>
          </div>
          <div className="space-y-3 text-sm text-ink">
            {(() => {
              const { earlier, later } = getNearbySchedules();
              return (
                <>
                  {earlier.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted">
                        Earlier
                      </p>
                      <div className="space-y-1">
                        {earlier.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-md border border-border bg-surface px-3 py-2"
                          >
                            {fmtScheduleEntry(entry)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {later.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted">
                        Later
                      </p>
                      <div className="space-y-1">
                        {later.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-md border border-border bg-surface px-3 py-2"
                          >
                            {fmtScheduleEntry(entry)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {earlier.length === 0 && later.length === 0 && (
                    <p className="text-sm text-muted">
                      No nearby scheduled maintenance was found.
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-muted">
                Start Date
              </label>
              <input
                type="date"
                value={formatDateInput(rangeStart)}
                onChange={(e) => {
                  const newDate = parseInputDate(e.target.value);
                  if (!newDate) return;
                  setRangeStart(newDate);
                  if (!rangeEnd || newDate > rangeEnd) {
                    setRangeEnd(newDate);
                  }
                }}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-muted">
                End Date
              </label>
              <input
                type="date"
                value={formatDateInput(effectiveEnd)}
                onChange={(e) => {
                  const newDate = parseInputDate(e.target.value);
                  if (!newDate) return;
                  const nextStart = !rangeStart || newDate < rangeStart ? newDate : rangeStart;
                  setRangeStart(nextStart);
                  setRangeEnd(newDate);
                }}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-white">
              <CalendarDays size={18} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-muted">
                Selected Date Range
              </p>
              <p className="font-bold text-ink">
                {rangeStart ? fmt(rangeStart) : "-"}
                {rangeEnd ? ` \u2013 ${fmt(rangeEnd)}` : ""}
              </p>
              {rangeStart && (
                <p className="text-xs text-muted">
                  {totalDays} day{totalDays > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-md bg-surface py-3 text-sm font-bold text-ink hover:bg-border"
          >
            Cancel
          </button>
          <button
            onClick={() => setStep(2)}
            disabled={!rangeStart}
            className="rounded-md bg-navy-800 py-3 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-60"
          >
            Apply Selection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold text-ink">
          Maintenance Details
        </h2>
        <p className="text-sm text-muted">
          Assign a technician and service type for the selected date range.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <label className="mb-1 block text-xs font-bold uppercase text-muted">
          Maintenance Name
        </label>
        <input
          value={maintenanceName}
          onChange={(e) => setMaintenanceName(e.target.value)}
          placeholder="Enter maintenance name"
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        />

        <label className="mb-1 block text-xs font-bold uppercase text-muted">
          Location 
        </label>
        <input
          value={locationDoor}
          onChange={(e) => setLocationDoor(e.target.value)}
          placeholder="e.g. Main Entrance - G01"
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        />

        <label className="mb-1 block text-xs font-bold uppercase text-muted">
          Checklist Templates
        </label>
        <div className="space-y-2">
          {templates.map((t) => {
            const templateInstances = templateSelections.filter(
              (sel) => sel.templateId === t.id,
            );
            return (
              <div key={t.id} className="rounded-md border border-border bg-white p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={templateInstances.length > 0}
                    onChange={() => toggleTemplateSelection(t.id)}
                    className="h-4 w-4 rounded border-border text-navy-800"
                  />
                  <span>{t.name}</span>
                </label>
                {templateInstances.length > 0 && (
                  <div className="mt-3 space-y-3">
                    <label className="text-xs text-muted">
                      Number of forms
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={templateInstances.length}
                          onChange={(e) =>
                            setTemplateCount(t.id, Number(e.target.value) || 1)
                          }
                          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setTemplateCount(t.id, templateInstances.length + 1)}
                          aria-label={`Add form for ${t.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-navy-800 hover:bg-surface"
                        >
                          +
                        </button>
                      </div>
                    </label>

                    <div className="overflow-hidden rounded-md border border-border bg-surface">
                      <div className="hidden md:grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-xs font-semibold text-muted">
                        <div>Location / gate</div>
                        <div className="text-right">Actions</div>
                      </div>
                      <div className="space-y-0 divide-y divide-border px-3 py-2">
                        {templateInstances.map((instance, idx) => (
                          <div
                            key={instance.id}
                            className="grid gap-3 md:grid-cols-[1fr_auto] items-center py-3"
                          >
                            <div>
                              <div className="text-xs font-semibold text-ink">Location / gate #{idx + 1}</div>
                              <input
                                value={instance.location}
                                onChange={(e) =>
                                  updateTemplateSelection(instance.id, {
                                    location: e.target.value,
                                  })
                                }
                                placeholder="e.g. Main Entrance - G01"
                                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => removeTemplateInstance(instance.id)}
                                className="rounded-md border border-danger-600 px-3 py-2 text-xs font-semibold text-danger-600 hover:bg-danger-100"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-muted">
          Each selected checklist can have multiple locations. One form = one location.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <label className="mb-1 block text-xs font-bold uppercase text-muted">
          Digital COP (Company Stamp)
        </label>
        {companyStamp ? (
          <div className="mb-2 flex items-center gap-3">
            <img src={companyStamp} alt="Company stamp" className="h-12 w-36 rounded-md border border-border object-contain p-1" />
            <div className="flex items-center gap-2">
              <input
                id="includeCompanyStamp"
                type="checkbox"
                checked={includeCompanyStamp}
                onChange={(e) => setIncludeCompanyStamp(e.target.checked)}
                className="h-4 w-4 rounded border-border text-navy-800"
              />
              <label htmlFor="includeCompanyStamp" className="text-sm text-ink">
                Include company stamp on generated reports for this schedule
              </label>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">No company stamp found. Add one under Settings → Company Profile.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <label className="mb-1 block text-xs font-bold uppercase text-muted">
          Customer
        </label>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">— No customer / general —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">
          Shown on the report generated from this schedule.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <label className="mb-1 block text-xs font-bold uppercase text-muted">
          Assigned Technician
        </label>
        <input
          value={technician}
          onChange={(e) => setTechnician(e.target.value)}
          placeholder="Ahmad Sulaiman"
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-muted">
              Start Date
            </label>
            <input
              type="date"
              value={formatDateInput(rangeStart)}
              onChange={(e) => {
                const newDate = parseInputDate(e.target.value);
                if (!newDate) return;
                setRangeStart(newDate);
                if (!rangeEnd || newDate > rangeEnd) {
                  setRangeEnd(newDate);
                }
              }}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-muted">
              End Date
            </label>
            <input
              type="date"
              value={formatDateInput(effectiveEnd)}
              onChange={(e) => {
                const newDate = parseInputDate(e.target.value);
                if (!newDate) return;
                const nextStart = !rangeStart || newDate < rangeStart ? newDate : rangeStart;
                setRangeStart(nextStart);
                setRangeEnd(newDate);
              }}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-white">
          <CalendarDays size={18} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase text-muted">
            Selected Date Range
          </p>
          <p className="font-bold text-ink">
            {fmt(rangeStart)}
            {rangeEnd ? ` \u2013 ${fmt(rangeEnd)}` : ""}
          </p>
          <p className="text-xs text-muted">
            {totalDays} day{totalDays > 1 ? "s" : ""}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setStep(1)}
          className="rounded-md bg-surface py-3 text-sm font-bold text-ink hover:bg-border"
        >
          Back
        </button>
        <button
          onClick={confirmSchedule}
          disabled={confirming}
          className="rounded-md bg-navy-800 py-3 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {confirming
            ? "Saving…"
            : isEditing
              ? "Save Changes"
              : "Confirm Schedule"}
        </button>
      </div>

      {isEditing && (
        <button
          onClick={() => setConfirmCancel(true)}
          disabled={cancelling}
          className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-danger-600 py-3 text-sm font-bold text-danger-600 hover:bg-danger-100 disabled:opacity-60"
        >
          <Trash2 size={16} />{" "}
          {cancelling ? "Cancelling…" : "Cancel This Maintenance"}
        </button>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this maintenance?"
        message="This schedule entry will be removed. Any report already linked to it stays untouched."
        confirmLabel="Cancel Maintenance"
        onConfirm={performCancelSchedule}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
