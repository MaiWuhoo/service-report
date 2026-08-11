import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FilePlus2,
  MapPin,
  Trash2,
  Pencil,
  LayoutTemplate,
  Copy,
} from "lucide-react";
import {
  listChecklistTemplates,
  deleteChecklistTemplate,
  duplicateChecklistTemplate,
} from "../lib/reportsApi";
import { DEFAULT_TEMPLATE } from "../lib/defaultTemplates";
import ConfirmDialog from "../components/ConfirmDialog";

export default function ChecklistTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);

  async function load() {
    try {
      setTemplates(await listChecklistTemplates());
    } catch {
      // Firestore not configured yet
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState(null);

  async function performDelete() {
    const t = confirmDeleteTemplate;
    if (!t) return;
    setConfirmDeleteTemplate(null);
    setDeletingId(t.id);
    try {
      await deleteChecklistTemplate(t.id);
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    } catch (err) {
      console.error("Failed to delete template:", err);
      alert(`Gagal padam template: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDuplicate(t) {
    setDuplicatingId(t.id);
    try {
      await duplicateChecklistTemplate(t);
      await load();
    } catch (err) {
      console.error("Failed to duplicate template:", err);
      alert(`Gagal duplicate template: ${err.message}`);
    } finally {
      setDuplicatingId(null);
    }
  }

  const allTemplates = [DEFAULT_TEMPLATE, ...templates];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-ink">
            Checklist Templates
          </h2>
          <p className="text-sm text-muted">
            Different gates or door types can use different inspection
            checklists.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate("/checklist-templates/new")}
            className="flex shrink-0 items-center gap-2 rounded-md bg-navy-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-navy-700"
          >
            <Plus size={16} /> New
          </button>
          <button
            onClick={() => navigate("/checklist-templates/import")}
            className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-white px-4 py-2.5 text-sm font-semibold text-navy-800 hover:bg-surface"
          >
            <FilePlus2 size={16} /> Import PDF
          </button>
        </div>
      </div>

      {loading && <p className="py-6 text-center text-muted">Loading…</p>}

      <div className="space-y-3">
        {allTemplates.map((t) => (
          <section
            key={t.id}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-white">
                  <LayoutTemplate size={18} />
                </span>
                <div>
                  <p className="font-bold text-ink">
                    {t.name}
                    {t.id === "default" && (
                      <span className="ml-2 rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-semibold text-navy-700">
                        Built-in
                      </span>
                    )}
                  </p>
                  {t.locationDoor && (
                    <p className="flex items-center gap-1 text-sm text-muted">
                      <MapPin size={13} /> {t.locationDoor}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {(t.sections ?? []).length} section(s) •{" "}
                    {(t.sections ?? []).reduce(
                      (sum, s) => sum + (s.items?.length ?? 0),
                      0,
                    )}{" "}
                    items
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => handleDuplicate(t)}
                  disabled={duplicatingId === t.id}
                  aria-label="Duplicate template"
                  title="Duplicate template"
                  className="rounded-md border border-navy-800 p-2 text-navy-800 hover:bg-navy-50 disabled:opacity-60"
                >
                  <Copy size={15} />
                </button>
                {t.id !== "default" && (
                  <>
                    <button
                      onClick={() =>
                        navigate(`/checklist-templates/${t.id}/edit`)
                      }
                      aria-label="Edit template"
                      title="Edit template"
                      className="rounded-md border border-navy-800 p-2 text-navy-800 hover:bg-navy-50"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteTemplate(t)}
                      disabled={deletingId === t.id}
                      aria-label="Delete template"
                      title="Delete template"
                      className="rounded-md border border-danger-600 p-2 text-danger-600 hover:bg-danger-100 disabled:opacity-60"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(confirmDeleteTemplate)}
        title={`Padam template "${confirmDeleteTemplate?.name ?? ""}"?`}
        message="Laporan yang dah guna template ni takkan terjejas — data disnapshot dalam laporan sedia ada."
        confirmLabel="Padam"
        onConfirm={performDelete}
        onCancel={() => setConfirmDeleteTemplate(null)}
      />
    </div>
  );
}
