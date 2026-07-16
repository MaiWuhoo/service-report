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
import ScheduleMaintenance from "./pages/ScheduleMaintenance";
import AddChecklist from "./pages/AddChecklist";
import Reports from "./pages/Reports";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <AuthGate>
      <Routes>
        {/* Public-style customer link — intentionally outside <Layout />, so no
            sidebar, header menu, or bottom nav is rendered. Customers only ever
            see this one report. */}
        <Route path="/sign/:id" element={<CustomerSign />} />

        <Route element={<Layout />}>
          <Route path="/" element={<Portal />} />
          <Route path="/checklist" element={<ChecklistTemplates />} />
          <Route path="/checklist/:id/:step" element={<ChecklistRunner />} />
          <Route path="/review/:id" element={<ReviewSignoff />} />
          <Route path="/schedule" element={<ScheduleMaintenance />} />
          <Route path="/checklist-templates/new" element={<AddChecklist />} />
          <Route path="/checklist-templates/:id/edit" element={<AddChecklist />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/new" element={<AddCustomer />} />
          <Route path="/customers/:id/edit" element={<AddCustomer />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </AuthGate>
  );
}
