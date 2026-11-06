import { useState } from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../lib/firebase";

const COLLECTIONS = [
  "serviceReports",
  "maintenanceSchedule",
  "checklistTemplates",
  "customers",
  "settings",
];

function sizeKB(obj) {
  return Math.round(JSON.stringify(obj).length / 1024);
}

// Largest field inside a doc (so we know WHAT is heavy)
function biggestField(data) {
  let best = ["-", 0];
  for (const [k, v] of Object.entries(data)) {
    const n = JSON.stringify(v ?? null).length;
    if (n > best[1]) best = [k, n];
  }
  return `${best[0]} (${Math.round(best[1] / 1024)} KB)`;
}

export default function DebugSizes() {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setRows([]);
    const all = [];
    const tot = {};
    for (const name of COLLECTIONS) {
      setMsg(`Reading ${name}…`);
      const t0 = performance.now();
      try {
        const snap = await getDocs(query(collection(db, name), limit(300)));
        let sum = 0;
        snap.docs.forEach((d) => {
          const data = d.data();
          const kb = sizeKB(data);
          sum += kb;
          all.push({ col: name, id: d.id, kb, big: biggestField(data) });
        });
        tot[name] = `${snap.size} docs, ${sum} KB, ${Math.round(performance.now() - t0)} ms`;
      } catch (e) {
        tot[name] = `ERROR ${e.message}`;
      }
      setTotals({ ...tot });
    }
    all.sort((a, b) => b.kb - a.kb);
    setRows(all.slice(0, 25));
    setMsg("Done");
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold">Firestore size check</h2>
      <p className="text-sm text-muted">
        Reads each collection once (this may take a while — that is the point).
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-md bg-navy-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {busy ? msg : "Run check"}
      </button>
      <pre className="overflow-x-auto rounded bg-yellow-100 p-3 text-xs">
        {Object.entries(totals).map(([k, v]) => `${k}: ${v}`).join("\n") || "—"}
      </pre>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left">
              <th className="p-1">Collection</th>
              <th className="p-1">Doc ID</th>
              <th className="p-1">KB</th>
              <th className="p-1">Heaviest field</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.col + r.id} className="border-t border-border">
                <td className="p-1">{r.col}</td>
                <td className="p-1">{r.id}</td>
                <td className="p-1 font-bold">{r.kb}</td>
                <td className="p-1">{r.big}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}