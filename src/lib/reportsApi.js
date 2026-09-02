import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  onSnapshot,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";

const reportsCol = collection(db, "serviceReports");
const scheduleCol = collection(db, "maintenanceSchedule");
const templatesCol = collection(db, "checklistTemplates");

/**
 * Atomically generates the next sequential report ID for the given year,
 * e.g. SR-2026-0001, SR-2026-0002, ... Uses a Firestore transaction on a
 * per-year counter doc so concurrent report creation never collides —
 * unlike a random number, which has a (small but real) chance of duplicates.
 */
export async function getNextReportId(year = new Date().getFullYear()) {
  const counterRef = doc(db, "counters", `reports-${year}`);
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().count ?? 0) : 0;
    const updated = current + 1;
    tx.set(counterRef, { count: updated }, { merge: true });
    return updated;
  });
  return `SR-${year}-${String(next).padStart(4, "0")}`;
}

export async function listRecentReports(count = 10) {
  const q = query(reportsCol, orderBy("createdAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getReport(id) {
  const snap = await getDoc(doc(db, "serviceReports", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createReport(data) {
  const ref = await addDoc(reportsCol, {
    ...data,
    status: "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateReport(id, data) {
  await updateDoc(doc(db, "serviceReports", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function updateReportSection(id, stepIndex, items, extraPayload = {}) {
  const reportRef = doc(db, "serviceReports", id);
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(reportRef);
    if (!snap.exists()) throw new Error("Report not found");
    const data = snap.data();
    
    // Safely update only the specific section by index
    const nextSections = data.sections.map((s, idx) => 
      idx === stepIndex ? { ...s, items } : s
    );
    
    const nextData = {
      ...data,
      ...extraPayload,
      sections: nextSections,
      updatedAt: serverTimestamp(),
    };
    
    tx.update(reportRef, {
      ...extraPayload,
      sections: nextSections,
      updatedAt: serverTimestamp(),
    });
    return nextData;
  });
}

export async function appendReportMedia(reportId, mediaEntry) {
  const reportRef = doc(db, "serviceReports", reportId);
  await updateDoc(reportRef, {
    media: arrayUnion(mediaEntry),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToReport(id, callback) {
  return onSnapshot(doc(db, "serviceReports", id), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    } else {
      callback(null);
    }
  });
}

export async function deleteReport(id) {
  await deleteDoc(doc(db, "serviceReports", id));
}

export async function listUpcomingSchedule() {
  const q = query(scheduleCol, orderBy("startDate", "asc"), limit(10));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listAllSchedule() {
  const q = query(scheduleCol, orderBy("startDate", "asc"), limit(500));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getScheduleEntry(id) {
  const snap = await getDoc(doc(db, "maintenanceSchedule", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updateScheduleEntry(id, data) {
  await updateDoc(doc(db, "maintenanceSchedule", id), data);
}

export async function deleteScheduleEntry(id) {
  await deleteDoc(doc(db, "maintenanceSchedule", id));
}

export async function createScheduleEntry(data) {
  const ref = await addDoc(scheduleCol, {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

const customersCol = collection(db, "customers");

export async function listCustomers() {
  const snap = await getDocs(customersCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getCustomer(id) {
  const snap = await getDoc(doc(db, "customers", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createCustomer(data) {
  const ref = await addDoc(customersCol, {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCustomer(id, data) {
  await updateDoc(doc(db, "customers", id), data);
}

export async function deleteCustomer(id) {
  await deleteDoc(doc(db, "customers", id));
}

export async function getCompanyProfile() {
  const snap = await getDoc(doc(db, "settings", "company"));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function saveCompanyProfile(data) {
  await setDoc(doc(db, "settings", "company"), data, { merge: true });
}

export async function getEngineerSignatures() {
  const snap = await getDoc(doc(db, "settings", "engineerSignatures"));
  if (!snap.exists()) return [];
  return snap.data().signatures ?? [];
}

export async function saveEngineerSignatures(signatures) {
  await setDoc(doc(db, "settings", "engineerSignatures"), { signatures }, { merge: true });
}

export async function getManagerSignatures() {
  const snap = await getDoc(doc(db, "settings", "managerSignatures"));
  if (!snap.exists()) return [];
  return snap.data().signatures ?? [];
}

export async function saveManagerSignatures(signatures) {
  await setDoc(doc(db, "settings", "managerSignatures"), { signatures }, { merge: true });
}

export async function autoSaveManagerSignature(name, signature, date) {
  if (!name || !name.trim() || !signature) return;
  try {
    const existing = await getManagerSignatures();
    const cleanName = name.trim();
    const idx = existing.findIndex(
      (s) => s.name.toLowerCase() === cleanName.toLowerCase()
    );
    let updated;
    if (idx >= 0) {
      updated = existing.map((s, i) =>
        i === idx ? { ...s, name: cleanName, signature, date: date || s.date } : s
      );
    } else {
      updated = [
        ...existing,
        {
          id: crypto?.randomUUID?.() ?? `m-sig-${Date.now()}`,
          name: cleanName,
          signature,
          date: date || new Date().toISOString().slice(0, 10),
        },
      ];
    }
    await saveManagerSignatures(updated);
    return updated;
  } catch (err) {
    console.error("Auto-save manager signature error:", err);
  }
}

export async function autoSaveEngineerSignature(name, signature, date) {
  if (!name || !name.trim() || !signature) return;
  try {
    const existing = await getEngineerSignatures();
    const cleanName = name.trim();
    const idx = existing.findIndex(
      (s) => s.name.toLowerCase() === cleanName.toLowerCase()
    );
    let updated;
    if (idx >= 0) {
      updated = existing.map((s, i) =>
        i === idx ? { ...s, name: cleanName, signature, date: date || s.date } : s
      );
    } else {
      updated = [
        ...existing,
        {
          id: crypto?.randomUUID?.() ?? `sig-${Date.now()}`,
          name: cleanName,
          signature,
          date: date || new Date().toISOString().slice(0, 10),
        },
      ];
    }
    await saveEngineerSignatures(updated);
    return updated;
  } catch (err) {
    console.error("Auto-save engineer signature error:", err);
  }
}

export async function listChecklistTemplates() {
  const snap = await getDocs(templatesCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getChecklistTemplate(id) {
  const snap = await getDoc(doc(db, "checklistTemplates", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updateChecklistTemplate(id, data) {
  await updateDoc(doc(db, "checklistTemplates", id), data);
}

export async function deleteChecklistTemplate(id) {
  await deleteDoc(doc(db, "checklistTemplates", id));
}

export async function duplicateChecklistTemplate(sourceTemplate) {
  const { id, createdAt, ...rest } = sourceTemplate;
  const newId = await createChecklistTemplate({
    ...rest,
    name: `${sourceTemplate.name} (Copy)`,
  });
  return newId;
}

export async function createChecklistTemplate(data) {
  const ref = await addDoc(templatesCol, {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
