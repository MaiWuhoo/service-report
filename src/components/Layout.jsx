import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-1 flex-col md:max-w-none">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-4 md:px-8 md:py-6">
          <Outlet />
        </main>
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
