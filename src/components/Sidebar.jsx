import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  FilePlus2,
  ListPlus,
  ListChecks,
  Building2,
  ChevronDown,
  X,
} from "lucide-react";
import { listChecklistTemplates } from "../lib/reportsApi";
import { DEFAULT_TEMPLATE } from "../lib/defaultTemplates";
import { createReportFromTemplate } from "../lib/createReportFromTemplate";

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [templates, setTemplates] = useState([DEFAULT_TEMPLATE]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [creatingId, setCreatingId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const custom = await listChecklistTemplates();
        setTemplates([DEFAULT_TEMPLATE, ...custom]);
      } catch {
        // Firestore not reachable yet — fall back to the built-in template only
      }
    })();
  }, []);

  function go(path) {
    navigate(path);
    onClose?.();
  }

  async function pickTemplate(template) {
    setCreatingId(template.id);
    try {
      const id = await createReportFromTemplate(template);
      navigate(`/checklist/${id}/0`);
      onClose?.();
    } catch (err) {
      console.error("Failed to create report:", err);
      alert(`Gagal buat laporan baru: ${err.message}`);
    } finally {
      setCreatingId(null);
    }
  }

  const isHome = location.pathname === "/";

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-white transition-transform duration-200 md:sticky md:top-0 md:z-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5 md:hidden">
          <span className="text-lg font-bold text-navy-800">Menu</span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="text-navy-800"
          >
            <X size={20} />
          </button>
        </div>

        <div className="hidden items-center gap-2 border-b border-border px-5 py-4 md:flex">
          <span className="text-base font-bold text-navy-800">
            Service Report
          </span>
        </div>

        <nav className="space-y-1 p-3">
          <button
            onClick={() => go("/")}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
              isHome ? "bg-navy-800 text-white" : "text-ink hover:bg-surface"
            }`}
          >
            <Home size={18} /> Home
          </button>

          {/* <div>
            <button
              onClick={() => setShowTemplates((s) => !s)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-ink hover:bg-surface"
            >
              <span className="flex items-center gap-3">
                <FilePlus2 size={18} /> New Service
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${showTemplates ? "rotate-180" : ""}`}
              />
            </button>

            {showTemplates && (
              <div className="ml-8 mt-1 space-y-0.5 border-l border-border pl-3">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => pickTemplate(t)}
                    disabled={creatingId !== null}
                    className="block w-full truncate rounded-md px-2 py-2 text-left text-sm text-muted hover:bg-surface hover:text-ink disabled:opacity-60"
                    title={t.name}
                  >
                    {creatingId === t.id ? "Creating…" : t.name}
                  </button>
                ))}
                {templates.length === 1 && (
                  <p className="px-2 py-1 text-xs text-muted">
                    No custom templates yet — try &quot;New Checklist&quot; below.
                  </p>
                )}
              </div>
            )}
          </div> */}

          <button
            onClick={() => go("/checklist")}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
              location.pathname === "/checklist"
                ? "bg-navy-800 text-white"
                : "text-ink hover:bg-surface"
            }`}
          >
            <ListChecks size={18} /> Checklist Templates
          </button>

          {/* <button
            onClick={() => go("/checklist-templates/new")}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-ink hover:bg-surface"
          >
            <ListPlus size={18} /> New Checklist
          </button> */}

          <button
            onClick={() => go("/customers")}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-ink hover:bg-surface"
          >
            <Building2 size={18} /> Customers
          </button>
        </nav>
      </aside>
    </>
  );
}
