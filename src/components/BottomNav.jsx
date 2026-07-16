import { NavLink } from "react-router-dom";
import { ClipboardCheck, FileText, History, Settings } from "lucide-react";

const items = [
  { to: "/checklist", label: "Checklist", icon: ClipboardCheck },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-border bg-white">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              isActive
                ? "text-white bg-navy-800"
                : "text-navy-800/70 hover:text-navy-800"
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
