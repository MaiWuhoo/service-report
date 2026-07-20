import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  CalendarDays,
  Pencil,
} from "lucide-react";
import { listAllSchedule, listChecklistTemplates } from "../lib/reportsApi";
import { resolveScheduleEntryUrl } from "../lib/openScheduleEntry";
import { DEFAULT_TEMPLATE } from "../lib/defaultTemplates";
import StatusBadge from "../components/StatusBadge";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dateToStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Full grid of weeks covering the month, including leading/trailing days
 *  from adjacent months — same as Google Calendar's month view. */
function buildCalendarWeeks(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const gridStart = startOfWeek(firstOfMonth);
  const gridEnd = addDays(startOfWeek(lastOfMonth), 6);

  const weeks = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** Lays out entries overlapping this week into non-overlapping horizontal
 *  lanes, clipped to the week's bounds — the same technique full calendar
 *  libraries use for multi-day event bars. */
function layoutWeekBars(week, schedule) {
  const weekStartStr = dateToStr(week[0]);
  const weekEndStr = dateToStr(week[6]);

  const overlapping = schedule.filter(
    (s) =>
      s.startDate &&
      s.endDate &&
      s.startDate <= weekEndStr &&
      s.endDate >= weekStartStr,
  );

  const bars = overlapping
    .map((entry) => {
      const clippedStart =
        entry.startDate < weekStartStr ? weekStartStr : entry.startDate;
      const clippedEnd =
        entry.endDate > weekEndStr ? weekEndStr : entry.endDate;
      const startCol = week.findIndex((d) => dateToStr(d) === clippedStart);
      const endCol = week.findIndex((d) => dateToStr(d) === clippedEnd);
      return { entry, startCol, endCol };
    })
    .sort(
      (a, b) =>
        a.startCol - b.startCol ||
        a.endCol - a.startCol - (b.endCol - b.startCol),
    );

  const lanes = [];
  bars.forEach((bar) => {
    let laneIdx = lanes.findIndex((lane) =>
      lane.every((b) => bar.startCol > b.endCol || bar.endCol < b.startCol),
    );
    if (laneIdx === -1) {
      lanes.push([bar]);
      laneIdx = lanes.length - 1;
    } else {
      lanes[laneIdx].push(bar);
    }
    bar.lane = laneIdx;
  });

  return { bars, laneCount: lanes.length };
}

export default function FullCalendar() {
  const navigate = useNavigate();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [schedule, setSchedule] = useState([]);
  const [templates, setTemplates] = useState([DEFAULT_TEMPLATE]);
  const [loading, setLoading] = useState(true);
  const [selectedDateStr, setSelectedDateStr] = useState(dateToStr(today));
  const [openingId, setOpeningId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [all, customTemplates] = await Promise.all([
          listAllSchedule(),
          listChecklistTemplates(),
        ]);
        setSchedule(all);
        setTemplates([DEFAULT_TEMPLATE, ...customTemplates]);
      } catch {
        // Firestore not reachable yet
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const weeks = useMemo(
    () => buildCalendarWeeks(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

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

  function goToToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDateStr(dateToStr(today));
  }

  function entriesOnDate(dateStr) {
    return schedule.filter(
      (s) =>
        s.startDate &&
        s.endDate &&
        dateStr >= s.startDate &&
        dateStr <= s.endDate,
    );
  }

  const selectedEntries = entriesOnDate(selectedDateStr);

  async function handleOpenEntry(entry) {
    setOpeningId(entry.id);
    try {
      const url = await resolveScheduleEntryUrl(entry, templates);
      navigate(url);
    } catch (err) {
      console.error("Failed to open scheduled checklist:", err);
      alert(`Gagal buka checklist: ${err.message}`);
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold text-ink">Full Calendar</h2>
        <p className="text-sm text-muted">
          Bars show maintenance spanning across its scheduled dates.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-4">
          <p className="text-lg font-bold text-ink">{monthLabel}</p>
          <div className="flex gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="rounded p-1.5 hover:bg-surface"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToToday}
              className="rounded px-2 py-1 text-xs font-semibold text-navy-700 hover:bg-surface"
            >
              Today
            </button>
            <button
              onClick={() => changeMonth(1)}
              className="rounded p-1.5 hover:bg-surface"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border text-center text-xs font-semibold text-muted">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="py-2">
              {w}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => {
          const { bars, laneCount } = layoutWeekBars(week, schedule);
          const MAX_LANES = 4;
          const visibleBars = bars.filter((b) => b.lane < MAX_LANES);
          const rowsToShow = Math.min(Math.max(laneCount, 1), MAX_LANES);
          const barRowH = 24;
          const dayRowH = 32;

          return (
            <div
              key={wi}
              className="grid grid-cols-7 border-b border-border last:border-b-0"
              style={{
                gridTemplateRows: `${dayRowH}px repeat(${rowsToShow}, ${barRowH}px)`,
                minHeight: dayRowH + MAX_LANES * barRowH,
              }}
            >
              {week.map((date, di) => {
                const dateStr = dateToStr(date);
                const inMonth = date.getMonth() === viewMonth;
                const isToday = dateStr === dateToStr(today);
                const isSelected = dateStr === selectedDateStr;
                return (
                  <button
                    key={di}
                    onClick={() => setSelectedDateStr(dateStr)}
                    style={{ gridColumn: di + 1, gridRow: 1 }}
                    className={`flex items-start justify-start border-r border-border p-1.5 text-xs last:border-r-0 ${
                      inMonth ? "text-ink" : "text-border"
                    }`}
                  >
                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-semibold ${
                        isSelected
                          ? "bg-navy-800 text-white"
                          : isToday
                            ? "border border-navy-800 text-navy-800"
                            : ""
                      }`}
                    >
                      {date.getDate() === 1
                        ? `${MONTH_ABBR[date.getMonth()]} 1`
                        : date.getDate()}
                    </span>
                  </button>
                );
              })}

              {visibleBars.map((bar) => (
                <button
                  key={bar.entry.id + wi}
                  onClick={() => handleOpenEntry(bar.entry)}
                  style={{
                    gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
                    gridRow: bar.lane + 2,
                  }}
                  className="mx-0.5 my-0.5 truncate rounded-full border border-teal-500 bg-teal-50 px-2 text-left text-[11px] font-semibold text-teal-700 hover:bg-teal-100"
                  title={bar.entry.title}
                >
                  {openingId === bar.entry.id ? "Opening…" : bar.entry.title}
                </button>
              ))}
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase text-navy-800">
            <CalendarDays size={16} />
            {new Date(selectedDateStr).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h3>
        </div>
        {loading && (
          <p className="px-5 py-6 text-center text-muted">Loading…</p>
        )}
        {!loading && selectedEntries.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-muted">
            No maintenance scheduled on this date.
          </p>
        )}
        <div className="divide-y divide-border">
          {selectedEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => handleOpenEntry(entry)}
              className="flex cursor-pointer items-center gap-4 px-5 py-4 hover:bg-surface"
            >
              <div className="flex-1">
                <p className="font-semibold text-ink">{entry.title}</p>
                <p className="flex items-center gap-1 text-sm text-muted">
                  <MapPin size={13} /> {entry.location || "-"}
                </p>
                {entry.durationDays > 1 && (
                  <p className="text-xs text-navy-700">
                    {entry.startDate} → {entry.endDate} ({entry.durationDays}{" "}
                    days)
                  </p>
                )}
                {entry.templateNames?.length ? (
                  <p className="text-xs text-muted">
                    Checklist: {entry.templateNames.join(", ")}
                  </p>
                ) : entry.templateName ? (
                  <p className="text-xs text-muted">
                    Checklist: {entry.templateName}
                  </p>
                ) : null}
              </div>
              <StatusBadge
                status={entry.reportId ? entry.status : "upcoming"}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/schedule/${entry.id}/edit`);
                }}
                aria-label="Edit schedule"
                title="Edit schedule"
                className="rounded-md border border-navy-800 p-1.5 text-navy-800 hover:bg-navy-50"
              >
                <Pencil size={14} />
              </button>
              {openingId === entry.id && (
                <span className="text-xs font-semibold text-navy-700">
                  Opening…
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
