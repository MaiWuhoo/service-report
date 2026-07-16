import { useRef } from "react";

export default function SignaturePad({ label, name, onNameChange, canvasRef, onClear }) {
  const drawing = useRef(false);

  function startDraw(e) {
    drawing.current = true;
    draw(e);
  }
  function endDraw() {
    drawing.current = false;
    canvasRef.current?.getContext("2d")?.beginPath();
  }
  function draw(e) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0a2f52";
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 text-sm font-bold uppercase text-navy-800">{label}</p>

      {onNameChange && (
        <>
          <label className="mb-1 block text-xs font-semibold text-ink">Full Name</label>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Ahmad Sulaiman"
            className="mb-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </>
      )}

      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-semibold text-ink">Signature</label>
        <button onClick={onClear} className="text-xs font-semibold text-navy-700 hover:underline">
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={360}
        height={120}
        className="w-full touch-none rounded-md border border-dashed border-border bg-surface"
        onMouseDown={startDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onMouseMove={draw}
        onTouchStart={startDraw}
        onTouchEnd={endDraw}
        onTouchMove={draw}
      />
    </div>
  );
}
