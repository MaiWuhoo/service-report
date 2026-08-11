import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listRecentReports } from "../lib/reportsApi";
import StatusBadge from "../components/StatusBadge";

export default function Media() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await listRecentReports(100);
        const filtered = loaded.filter((report) => {
          const hasReportMedia = Array.isArray(report.media) && report.media.length > 0;
          const hasItemPhotos = (report.sections ?? []).some((section) =>
            (section.items ?? []).some(
              (item) =>
                (Array.isArray(item.photos) && item.photos.length > 0) ||
                Boolean(item.photo),
            ),
          );
          return hasReportMedia || hasItemPhotos;
        });
        setReports(filtered);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-ink">Media Module</h2>
          <p className="text-sm text-muted">
            Browse reports that contain captured media and open the media gallery.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold uppercase text-navy-800">Reports With Media</h3>
        </div>
        <div className="divide-y divide-border">
          {loading && (
            <p className="px-5 py-6 text-center text-muted">Loading…</p>
          )}
          {!loading && reports.length === 0 && (
            <p className="px-5 py-6 text-center text-muted">
              No report media found yet.
            </p>
          )}
          {reports.map((report) => (
            <button
              type="button"
              key={report.id}
              onClick={() => navigate(`/report-media/${report.id}`)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface"
            >
              <div>
                <p className="font-semibold text-ink">{report.templateName || "Untitled Report"}</p>
                <p className="text-sm text-muted">
                  {report.dateOfService} • {report.locationDoor}
                </p>
              </div>
              <StatusBadge status={report.status} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
