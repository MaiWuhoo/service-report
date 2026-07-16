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

export async function deleteReport(id) {
  await deleteDoc(doc(db, "serviceReports", id));
}

export async function listUpcomingSchedule() {
  const q = query(scheduleCol, orderBy("startDate", "asc"), limit(10));
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

export async function createChecklistTemplate(data) {
  const ref = await addDoc(templatesCol, {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
