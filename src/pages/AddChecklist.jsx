import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Save, Trash2, FolderPlus } from "lucide-react";
import {
  createChecklistTemplate,
  getChecklistTemplate,
  updateChecklistTemplate,
} from "../lib/reportsApi";

let uid = 1;
function nextId() {
  return uid++;
}

function emptySection(name = "") {
  return { key: nextId(), sectionName: name, rows: [{ key: nextId(), text: "" }] };
}

export default function AddChecklist() {
  const navigate = useNavigate();
  const { id } = useParams(); // present when editing an existing template
  const isEditing = Boolean(id);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Access Control");
  const [locationDoor, setLocationDoor] = useState("");
  const [technician, setTechnician] = useState("");
  const [sections, setSections] = useState([emptySection("Section 1")]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const t = await getChecklistTemplate(id);
      if (!t) return;
      setName(t.name ?? "");
      setCategory(t.category ?? "Access Control");
      setLocationDoor(t.locationDoor ?? "");
      setTechnician(t.assignedTechnician ?? "");
      setSections(
        (t.sections ?? []).map((s) => ({
          key: nextId(),
          sectionName: s.sectionName,
          rows: (s.items ?? []).map((it) => ({ key: nextId(), text: it.question })),
        }))
      );
    })();
  }, [id, isEditing]);

  function updateSectionName(sKey, value) {
    setSections((prev) => prev.map((s) => (s.key === sKey ? { ...s, sectionName: value } : s)));
  }

  function updateRow(sKey, rKey, text) {
    setSections((prev) =>
      prev.map((s) =>
        s.key === sKey
          ? { ...s, rows: s.rows.map((r) => (r.key === rKey ? { ...r, text } : r)) }
          : s
      )
    );
  }

  function addRow(sKey) {
    setSections((prev) =>
      prev.map((s) => (s.key === sKey ? { ...s, rows: [...s.rows, { key: nextId(), text: "" }] } : s))
    );
  }

  function removeRow(sKey, rKey) {
    setSections((prev) =>
      prev.map((s) => (s.key === sKey ? { ...s, rows: s.rows.filter((r) => r.key !== rKey) } : s))
    );
  }

  function addSection() {
    setSections((prev) => [...prev, emptySection(`Section ${prev.length + 1}`)]);
  }

  function removeSection(sKey) {
    setSections((prev) => prev.filter((s) => s.key !== sKey));
  }

  async function saveTemplate() {
    const payload = {
      name,
      category,
      locationDoor,
      assignedTechnician: technician,
      sections: sections
        .filter((s) => s.sectionName.trim() !== "")
        .map((s) => ({
          sectionName: s.sectionName,
          items: s.rows.filter((r) => r.text.trim() !== "").map((r) => ({ question: r.text })),
        })),
    };

    setSaving(true);
    try {
      if (isEditing) {
        await updateChecklistTemplate(id, payload);
      } else {
        await createChecklistTemplate(payload);
      }
      navigate("/checklist");
    } catch (err) {
      console.error("Failed to save template:", err);
      alert(`Gagal simpan template: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold text-ink">
          {isEditing ? "Edit Checklist" : "Add New Checklist"}
        </h2>
        <p className="text-sm text-muted">
          Create a master template for a specific gate or door type — different gates
          can have completely different inspection items.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 border-b border-border pb-2 text-sm font-bold uppercase text-navy-800">
          General Information
        </h3>
        <label className="mb-1 block text-sm font-semibold text-ink">Checklist Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Gate 3 Cargo Entrance"
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        />

        <label className="mb-1 block text-sm font-semibold text-ink">Applies to Location / Door</label>
        <input
          value={locationDoor}
          onChange={(e) => setLocationDoor(e.target.value)}
          placeholder="e.g., Gate 3 - Cargo Bay"
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        />

        <label className="mb-1 block text-sm font-semibold text-ink">Category</label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g., Access Control"
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        />

        {/* <label className="mb-1 block text-sm font-semibold text-ink">Assigned Technician</label>
        <input
          value={technician}
          onChange={(e) => setTechnician(e.target.value)}
          placeholder="e.g., Ahmad Sulaiman"
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        /> */}
      </section>

      {sections.map((section, sIdx) => (
        <section key={section.key} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2">
            <input
              value={section.sectionName}
              onChange={(e) => updateSectionName(section.key, e.target.value)}
              placeholder={`Section ${sIdx + 1} name (e.g., Entry Check)`}
              className="flex-1 border-none bg-transparent text-sm font-bold uppercase text-navy-800 outline-none"
            />
            {sections.length > 1 && (
              <button
                onClick={() => removeSection(section.key)}
                aria-label="Remove section"
                className="rounded p-1 text-danger-600 hover:bg-danger-100"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {section.rows.map((row, idx) => (
              <div key={row.key} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-bold text-navy-800">
                  {idx + 1}
                </span>
                <input
                  value={row.text}
                  onChange={(e) => updateRow(section.key, row.key, e.target.value)}
                  placeholder="Check hinge lubrication..."
                  className="flex-1 rounded-md border border-border bg-white px-3 py-2.5 text-sm"
                />
                {section.rows.length > 1 && (
                  <button
                    onClick={() => removeRow(section.key, row.key)}
                    aria-label="Remove item"
                    className="text-muted hover:text-danger-600"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => addRow(section.key)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-3 text-sm font-semibold text-navy-700 hover:bg-surface"
          >
            <Plus size={16} /> Add Row
          </button>
        </section>
      ))}

      <button
        onClick={addSection}
        className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-navy-800 py-3 text-sm font-semibold text-navy-800 hover:bg-navy-50"
      >
        <FolderPlus size={16} /> Add Section
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-md border border-border bg-white py-3 text-sm font-bold text-ink hover:bg-surface"
        >
          Cancel
        </button>
        <button
          onClick={saveTemplate}
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-md bg-navy-800 py-3 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-60"
        >
          <Save size={16} /> {saving ? "Saving…" : "Save Template"}
        </button>
      </div>
    </div>
  );
}
