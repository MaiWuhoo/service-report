import { useEffect, useState } from "react";
import { listRecentReports } from "../lib/reportsApi";
import StatusBadge from "../components/StatusBadge";

export default function HistoryPage() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        setReports(await listRecentReports(100));
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-ink">History</h2>
      <section className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {reports.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-bold text-ink">{r.reportId}</p>
              <p className="text-sm text-muted">{r.dateOfService}</p>
            </div>
            <StatusBadge status={r.status} />
          </div>
        ))}
        {reports.length === 0 && <p className="px-5 py-6 text-center text-muted">No history yet.</p>}
      </section>
    </div>
  );
}
