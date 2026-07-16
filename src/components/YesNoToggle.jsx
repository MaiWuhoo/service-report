export default function YesNoToggle({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border">
      <button
        type="button"
        onClick={() => onChange("yes")}
        className={`py-2.5 text-sm font-semibold transition-colors ${
          value === "yes"
            ? "bg-navy-800 text-white"
            : "bg-white text-ink hover:bg-navy-50"
        }`}
      >
        YES
      </button>
      <button
        type="button"
        onClick={() => onChange("no")}
        className={`border-l border-border py-2.5 text-sm font-semibold transition-colors ${
          value === "no"
            ? "bg-danger-600 text-white"
            : "bg-white text-ink hover:bg-navy-50"
        }`}
      >
        NO
      </button>
    </div>
  );
}
