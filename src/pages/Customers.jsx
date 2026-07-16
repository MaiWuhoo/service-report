import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { listCustomers, deleteCustomer } from "../lib/reportsApi";

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setCustomers(await listCustomers());
      } catch {
        // Firestore not configured yet
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleDelete(c) {
    const ok = window.confirm(
      `Padam customer "${c.name}"? Template yang dah guna customer ni takkan terjejas (data disnapshot dalam laporan sedia ada).`
    );
    if (!ok) return;
    setDeletingId(c.id);
    try {
      await deleteCustomer(c.id);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) {
      console.error("Failed to delete customer:", err);
      alert(`Gagal padam customer: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-ink">Customers</h2>
          <p className="text-sm text-muted">
            Manage customer records once — pick them from a dropdown when building checklist
            templates.
          </p>
        </div>
        <button
          onClick={() => navigate("/customers/new")}
          className="flex shrink-0 items-center gap-2 rounded-md bg-navy-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-navy-700"
        >
          <Plus size={16} /> New
        </button>
      </div>

      {loading && <p className="py-6 text-center text-muted">Loading…</p>}
      {!loading && customers.length === 0 && (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted shadow-sm">
          No customers yet — add one to reuse across checklist templates.
        </p>
      )}

      <div className="space-y-3">
        {customers.map((c) => (
          <section key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {c.logo ? (
                  <img
                    src={c.logo}
                    alt={`${c.name} logo`}
                    className="h-10 w-10 shrink-0 rounded-md border border-border object-contain p-0.5"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-white">
                    <Building2 size={18} />
                  </span>
                )}
                <div>
                  <p className="font-bold text-ink">{c.name}</p>
                  <p className="text-sm text-muted">{c.address}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => navigate(`/customers/${c.id}/edit`)}
                  aria-label="Edit customer"
                  className="rounded-md border border-navy-800 p-2 text-navy-800 hover:bg-navy-50"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  disabled={deletingId === c.id}
                  aria-label="Delete customer"
                  className="rounded-md border border-danger-600 p-2 text-danger-600 hover:bg-danger-100 disabled:opacity-60"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
