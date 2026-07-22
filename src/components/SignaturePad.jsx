import { useRef, useEffect } from "react";

export default function SignaturePad({ label, name, onNameChange, canvasRef, onClear }) {
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e) => {
      e.preventDefault();
      drawing.current = true;
      drawNative(e);
    };
    const handleTouchMove = (e) => {
      e.preventDefault();
      drawNative(e);
    };
    const handleTouchEnd = (e) => {
      e.preventDefault();
      drawing.current = false;
      canvas.getContext("2d")?.beginPath();
    };

    const handleMouseDown = (e) => {
      drawing.current = true;
      drawNative(e);
    };
    const handleMouseMove = (e) => {
      drawNative(e);
    };
    const handleMouseUp = () => {
      drawing.current = false;
      canvas.getContext("2d")?.beginPath();
    };

    function drawNative(e) {
      if (!drawing.current) return;
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      
      const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
      
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#0a2f52";
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });
    
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [canvasRef]);

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
        <button type="button" onClick={onClear} className="text-xs font-semibold text-navy-700 hover:underline">
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={360}
        height={120}
        className="w-full touch-none rounded-md border border-dashed border-border bg-surface"
      />
    </div>
  );
}
