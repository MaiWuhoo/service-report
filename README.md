# Service Report — Maintenance Portal

React (Vite) + Tailwind v4 + Firebase (Firestore) + PDF report generation.

## 1. Setup

```bash
npm install
cp .env.example .env.local
```

Isi `.env.local` dengan config Firebase korang (Firebase Console → Project Settings →
General → Your apps → SDK setup and configuration).

Enable **Firestore Database** dalam Firebase Console (Build → Firestore Database →
Create database).

**Wajib**: enable **Anonymous** sign-in — Build → Authentication → Get started →
Sign-in method → Anonymous → Enable. App ni sign-in setiap visitor secara automatik
(diam-diam, tiada login form) supaya `request.auth != null` dalam `firestore.rules`
dipenuhi. **Kalau step ni terlepas, semua butang yang tulis data (New Service Report,
Confirm Schedule, Save Progress, dsb.) akan nampak macam "tak jadi apa-apa"** — app
sekarang akan popup alert dengan mesej error sebenar jika ini berlaku, supaya senang
nak debug.

Deploy `firestore.rules` yang disertakan:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # pilih project sedia ada
firebase deploy --only firestore:rules
```

## 2. Run locally

```bash
npm run dev
```

## 3. Struktur Data (Firestore)

- `serviceReports/{id}` — setiap laporan servis (sections diambil terus dari template
  yang dipilih semasa laporan dicipta, jadi tiap laporan simpan salinan sendiri)
- `maintenanceSchedule/{id}` — jadual penyelenggaraan akan datang (support date range)
- `checklistTemplates/{id}` — template checklist induk, setiap satu boleh ada
  **berbilang section** (contoh: "Entry Check", "Exit Check", "Safety") dan diikat
  kepada gate/door tertentu (`locationDoor`). Ada satu template built-in
  ("Access Door - Standard") yang sentiasa wujud walaupun Firestore kosong.

Lihat `src/lib/reportsApi.js` untuk semua fungsi CRUD, dan
`src/lib/defaultTemplates.js` untuk template fallback.

### Multi-template flow

1. **Portal** (`/`) — pilih **Checklist Template** (ditarik dari Firestore), isi
   Location Door + Lead Technician → "New Service Report" akan salin section-section
   dari template terpilih ke dalam laporan baru.
2. **`/checklist/:id/:step`** — halaman checklist dinamik, ikut berapa banyak section
   yang ada dalam template tu. "Next" akan pergi ke section seterusnya atau ke Review
   bila dah sampai section terakhir.
3. **`/checklist`** (tab bawah "Checklist") — urus semua template: cipta, edit, padam.
4. **`/checklist-templates/new`** — cipta template baru dengan berbilang section, tiap
   section boleh ada berbilang item.

## 4. Report PDF

`src/lib/generateReport.js` guna `jsPDF` + `jspdf-autotable` untuk generate PDF terus
dari data Firestore — dipanggil dari page **Reports** (butang download) dan
**Review & Sign-off** (butang Approve & Finalize).

## 5. Deploy ke Vercel

```bash
npm run build
```

1. Push repo ni ke GitHub.
2. Import project dalam Vercel Dashboard (vercel.com/new).
3. Framework preset: **Vite**. Build command: `vite build`. Output dir: `dist`.
4. Tambah semua env var (`VITE_FIREBASE_*`) dalam Project Settings → Environment Variables.
5. Lepas deploy, pergi **Firebase Console → Authentication → Settings → Authorized
   domains** dan tambah domain Vercel korang (`your-app.vercel.app`) — kalau tak, login
   akan blocked.

## Struktur Halaman

| Route | Page |
|---|---|
| `/` | Maintenance Portal (dashboard) |
| `/checklist` | Senarai & urus Checklist Templates |
| `/checklist/:id/:step` | Checklist dinamik (ikut template) |
| `/checklist-templates/new` | Cipta template checklist baru |
| `/checklist-templates/:id/edit` | Edit template sedia ada |
| `/review/:id` | Review & Sign-off |
| `/schedule` | Schedule Maintenance (date range) |
| `/reports` | Semua laporan + download PDF + padam draf |
| `/history` | Log laporan lepas |
| `/settings` | Tetapan |
