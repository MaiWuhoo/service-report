import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { createScheduleEntry, listChecklistTemplates, listCustomers } from "../lib/reportsApi";
import { DEFAULT_TEMPLATE } from "../lib/defaultTemplates";

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

export default function ScheduleMaintenance() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Range selection state
  const [rangeStart, setRangeStart] = useState(today);
  const [rangeEnd, setRangeEnd] = useState(null);

  const [maintenanceName, setMaintenanceName] = useState("Quarterly Access Door Service");
  const [technician, setTechnician] = useState("");
  const [locationDoor, setLocationDoor] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [confirming, setConfirming] = useState(false);

  const [templates, setTemplates] = useState([DEFAULT_TEMPLATE]);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE.id);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");

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
    })();
  }, []);

  const cells = buildMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  function changeMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
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
  const totalDays = rangeStart ? dayCount(rangeStart, new Date(effectiveEnd)) : 0;

  async function confirmSchedule() {
    setConfirming(true);
    try {
      const template = templates.find((t) => t.id === templateId) ?? DEFAULT_TEMPLATE;
      await createScheduleEntry({
        title: maintenanceName,
        location: locationDoor,
        startDate: rangeStart.toISOString().slice(0, 10),
        endDate: effectiveEnd.toISOString().slice(0, 10),
        monthLabel: rangeStart.toLocaleString("en-US", { month: "short" }).toUpperCase(),
        dayLabel: rangeStart.getDate(),
        durationDays: totalDays,
        assignedTechnician: technician,
        priority,
        templateId: template.id,
        templateName: template.name,
        customerId: customerId || null,
        status: "upcoming",
      });
      navigate("/");
    } catch (err) {
      console.error("Failed to schedule maintenance:", err);
      alert(`Gagal jadualkan maintenance: ${err.message}`);
    } finally {
      setConfirming(false);
    }
  }

  if (step === 1) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-extrabold text-ink">Select Maintenance Date Range</h2>
          <p className="text-sm text-muted">
            Tap a start date, then an end date to schedule a multi-day inspection window.
          </p>
        </div>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-bold text-ink">{monthLabel}</p>
            <div className="flex gap-2">
              <button onClick={() => changeMonth(-1)} className="rounded p-1 hover:bg-surface">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => changeMonth(1)} className="rounded p-1 hover:bg-surface">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const inRange = isInRange(d);
              const endpoint = isEndpoint(d);
              const isToday =
                today.getDate() === d && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
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

        <section className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-white">
            <CalendarDays size={18} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase text-muted">Selected Date Range</p>
            <p className="font-bold text-ink">
              {rangeStart ? fmt(rangeStart) : "-"}
              {rangeEnd ? ` \u2013 ${fmt(rangeEnd)}` : ""}
            </p>
            {rangeStart && (
              <p className="text-xs text-muted">{totalDays} day{totalDays > 1 ? "s" : ""}</p>
            )}
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
        <h2 className="text-2xl font-extrabold text-ink">Maintenance Details</h2>
        <p className="text-sm text-muted">Assign a technician and service type for the selected date range.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <label className="mb-1 block text-xs font-bold uppercase text-muted">Maintenance Name</label>
        <select
          value={maintenanceName}
          onChange={(e) => setMaintenanceName(e.target.value)}
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        >
          <option>Quarterly Access Door Service</option>
          <option>HVAC System Check</option>
          <option>Fire Alarm Testing</option>
        </select>

        <label className="mb-1 block text-xs font-bold uppercase text-muted">Location Door</label>
        <input
          value={locationDoor}
          onChange={(e) => setLocationDoor(e.target.value)}
          placeholder="e.g. Main Entrance - G01"
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        />

        <label className="mb-1 block text-xs font-bold uppercase text-muted">Checklist Template</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">
          This determines which checklist opens when you tap this schedule entry later.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <label className="mb-1 block text-xs font-bold uppercase text-muted">Customer</label>
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
        <p className="mt-1 text-xs text-muted">Shown on the report generated from this schedule.</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <label className="mb-1 block text-xs font-bold uppercase text-muted">Assigned Technician</label>
        <input
          value={technician}
          onChange={(e) => setTechnician(e.target.value)}
          placeholder="Ahmad Sulaiman"
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        />
      </section>

      <section className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-white">
          <CalendarDays size={18} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Selected Date Range</p>
          <p className="font-bold text-ink">
            {fmt(rangeStart)}
            {rangeEnd ? ` \u2013 ${fmt(rangeEnd)}` : ""}
          </p>
          <p className="text-xs text-muted">{totalDays} day{totalDays > 1 ? "s" : ""}</p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setStep(1)}
          className="rounded-md bg-surface py-3 text-sm font-bold text-ink hover:bg-border"
        >
          Cancel
        </button>
        <button
          onClick={confirmSchedule}
          disabled={confirming}
          className="rounded-md bg-navy-800 py-3 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {confirming ? "Saving…" : "Confirm Schedule"}
        </button>
      </div>
    </div>
  );
}
