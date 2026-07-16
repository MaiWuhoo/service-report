import { Menu, CircleUserRound } from "lucide-react";

export default function Header({ title = "Service Report", onMenuClick }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-white px-4 py-3.5 md:px-8">
      <div className="flex items-center gap-3">
        <button
          aria-label="Open menu"
          onClick={onMenuClick}
          className="text-navy-800 hover:text-navy-600 transition-colors md:hidden"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-lg font-bold text-navy-800">{title}</h1>
      </div>
      <button aria-label="Account" className="text-navy-800 hover:text-navy-600 transition-colors">
        <CircleUserRound size={24} />
      </button>
    </header>
  );
}
