import { Routes, Route } from "react-router-dom";
import AuthGate from "./components/AuthGate";
import Layout from "./components/Layout";
import Portal from "./pages/Portal";
import ChecklistRunner from "./pages/ChecklistRunner";
import ChecklistTemplates from "./pages/ChecklistTemplates";
import Customers from "./pages/Customers";
import AddCustomer from "./pages/AddCustomer";
import ReviewSignoff from "./pages/ReviewSignoff";
import CustomerSign from "./pages/CustomerSign";
import CustomerSignBatch from "./pages/CustomerSignBatch";
import ShareLinkRedirect from "./pages/ShareLinkRedirect";
import ScheduleMaintenance from "./pages/ScheduleMaintenance";
import ScheduleForms from "./pages/ScheduleForms";
import FullCalendar from "./pages/FullCalendar";
import AddChecklist from "./pages/AddChecklist";
import ImportChecklistFromPdf from "./pages/ImportChecklistFromPdf";
import Reports from "./pages/Reports";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import ReportMedia from "./pages/ReportMedia";
import Media from "./pages/Media";

export default function App() {
  return (
    <AuthGate>
      <Routes>
        {/* Public-style customer link — intentionally outside <Layout />, so no
            sidebar, header menu, or bottom nav is rendered. Customers only ever
            see this one report. */}
        <Route path="/sign/:id" element={<CustomerSign />} />
        <Route path="/sign-batch/:ids" element={<CustomerSignBatch />} />
        <Route path="/s/:token" element={<ShareLinkRedirect />} />

        <Route element={<Layout />}>
          <Route path="/" element={<Portal />} />
          <Route path="/checklist" element={<ChecklistTemplates />} />
          <Route path="/checklist/:id/:step" element={<ChecklistRunner />} />
          <Route path="/review/:id" element={<ReviewSignoff />} />
          <Route path="/schedule" element={<ScheduleMaintenance />} />
          <Route path="/schedule/:id/edit" element={<ScheduleMaintenance />} />
          <Route path="/schedule/:id/open" element={<ScheduleForms />} />
          <Route path="/calendar" element={<FullCalendar />} />
          <Route path="/checklist-templates/new" element={<AddChecklist />} />
          <Route path="/checklist-templates/import" element={<ImportChecklistFromPdf />} />
          <Route
            path="/checklist-templates/:id/edit"
            element={<AddChecklist />}
          />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/new" element={<AddCustomer />} />
          <Route path="/customers/:id/edit" element={<AddCustomer />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/media" element={<Media />} />
          <Route path="/report-media/:id" element={<ReportMedia />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </AuthGate>
  );
}
