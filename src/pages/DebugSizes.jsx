import { useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { uploadImageToCloudinary } from "../lib/cloudinaryUtils";

const COLLECTIONS = [
  "serviceReports",
  "maintenanceSchedule",
  "checklistTemplates",
  "customers",
  "settings",
];

// Only images bigger than this (characters) are moved out. Small canvas
// signatures stay as they are, so nothing else in the app has to change.
const MIN_LEN = 30000;

const isBigImage = (v) =>
  typeof v === "string" && v.startsWith("data:image") && v.length > MIN_LEN;

const isPlain = (v) =>
  v !== null &&
  typeof v === "object" &&
  (Object.getPrototypeOf(v) === Object.prototype || Array.isArray(v));

function countBig(v) {
  if (isBigImage(v)) return 1;
  if (Array.isArray(v)) return v.reduce((n, x) => n + countBig(x), 0);
  if (isPlain(v)) return Object.values(v).reduce((n, x) => n + countBig(x), 0);
  return 0;
}

const sizeKB = (o) => Math.round(JSON.stringify(o).length / 1024);

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
  const [log, setLog] = useState([]);
  const stopRef = useRef(false);
  const cacheRef = useRef(new Map()); // data URL -> cloudinary URL

  const say = (m) => setLog((l) => [...l.slice(-200), m]);

  async function runCheck() {
    setBusy(true);
    setRows([]);
    const all = [];
    const tot = {};
    for (const name of COLLECTIONS) {
      say(`Reading ${name}…`);
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
        tot[name] =
          `${snap.size} docs, ${sum} KB, ${Math.round(performance.now() - t0)} ms`;
      } catch (e) {
        tot[name] = `ERROR ${e.message}`;
      }
      setTotals({ ...tot });
    }
    all.sort((a, b) => b.kb - a.kb);
    setRows(all.slice(0, 25));
    say("Size check done");
    setBusy(false);
  }

  async function backup() {
    setBusy(true);
    try {
      const out = {};
      for (const name of COLLECTIONS) {
        say(`Backup: reading ${name}…`);
        const snap = await getDocs(query(collection(db, name), limit(500)));
        out[name] = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      }
      const blob = new Blob([JSON.stringify(out)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `firestore-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      say(`Backup downloaded (${Math.round(blob.size / 1024 / 1024)} MB)`);
    } catch (e) {
      say(`Backup FAILED: ${e.message}`);
    }
    setBusy(false);
  }

  async function toUrl(dataUrl, label) {
    const cache = cacheRef.current;
    if (cache.has(dataUrl)) return cache.get(dataUrl);
    const blob = await (await fetch(dataUrl)).blob();
    const url = await uploadImageToCloudinary(
      `migrated/${label}-${Date.now()}-${cache.size}`,
      blob,
    );
    cache.set(dataUrl, url);
    return url;
  }

  // Returns a copy of `v` with every big data-URL image replaced by a URL.
  async function convert(v, label, stats) {
    if (isBigImage(v)) {
      try {
        const url = await toUrl(v, label);
        stats.converted++;
        return url;
      } catch (e) {
        stats.failed++;
        say(`  upload failed (${label}): ${e.message}`);
        return v; // keep original — never lose data
      }
    }
    if (Array.isArray(v)) {
      const out = [];
      for (let i = 0; i < v.length; i++)
        out.push(await convert(v[i], `${label}-${i}`, stats));
      return out;
    }
    if (isPlain(v)) {
      const out = {};
      for (const [k, x] of Object.entries(v))
        out[k] = await convert(x, `${label}-${k}`, stats);
      return out;
    }
    return v;
  }

  async function migrate(dryRun) {
    stopRef.current = false;
    setBusy(true);
    const stats = { docs: 0, touched: 0, images: 0, converted: 0, failed: 0 };
    try {
      for (const name of COLLECTIONS) {
        say(`${dryRun ? "[dry] " : ""}${name}…`);
        const snap = await getDocs(query(collection(db, name), limit(500)));
        for (const d of snap.docs) {
          if (stopRef.current) throw new Error("Stopped by user");
          stats.docs++;
          const data = d.data();
          const changed = {};
          for (const [k, v] of Object.entries(data)) {
            const n = countBig(v);
            if (!n) continue;
            stats.images += n;
            if (!dryRun)
              changed[k] = await convert(v, `${name}-${d.id}-${k}`, stats);
          }
          if (Object.keys(changed).length) {
            await updateDoc(doc(db, name, d.id), changed);
            stats.touched++;
            say(
              `  ${name}/${d.id}: updated ${Object.keys(changed).join(", ")}`,
            );
          } else if (dryRun && Object.values(data).some((v) => countBig(v))) {
            stats.touched++;
          }
        }
      }
      say(
        `${dryRun ? "DRY RUN" : "MIGRATION"} done — docs read: ${stats.docs}, docs ${
          dryRun ? "needing change" : "changed"
        }: ${stats.touched}, big images found: ${stats.images}` +
          (dryRun
            ? ""
            : `, converted: ${stats.converted}, failed: ${stats.failed}`),
      );
    } catch (e) {
      say(`STOPPED: ${e.message}`);
    }
    setBusy(false);
  }

  const btn =
    "rounded-md bg-navy-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-60";

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold">
        Firestore size check &amp; slim-down
      </h2>
      <p className="text-sm text-muted">
        Order: 1) Run check, 2) Backup, 3) Dry run, 4) Migrate. Do not use the
        app on other devices while migrating.
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={runCheck} disabled={busy} className={btn}>
          1. Run check
        </button>
        <button onClick={backup} disabled={busy} className={btn}>
          2. Backup JSON
        </button>
        <button onClick={() => migrate(true)} disabled={busy} className={btn}>
          3. Dry run
        </button>
        <button onClick={() => migrate(false)} disabled={busy} className={btn}>
          4. Migrate
        </button>
        <button
          onClick={() => (stopRef.current = true)}
          className="rounded-md border border-danger-600 px-3 py-2 text-xs font-bold text-danger-600"
        >
          Stop
        </button>
      </div>
      <pre className="overflow-x-auto rounded bg-yellow-100 p-3 text-xs">
        {Object.entries(totals)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n") || "—"}
      </pre>
      <pre className="max-h-64 overflow-auto rounded bg-surface p-3 text-xs">
        {log.join("\n") || "log…"}
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
