import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FilePlus2, Image } from "lucide-react";
import {
  parsePdfTextToTemplate,
  saveParsedPdfTextTemplate,
  saveParsedPdfTemplate,
} from "../lib/pdfTemplateImporter.js";
import RichEditor from "../components/RichEditor.jsx";
import { downloadDocxFromTemplate } from "../lib/docxExporter.js";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/build/pdf.js";
import { createWorker } from "tesseract.js";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export default function ImportChecklistFromPdf() {
  const navigate = useNavigate();
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parsedTemplate, setParsedTemplate] = useState(null);
  const [editableTemplate, setEditableTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const editorRef = useRef(null);
  const [imgMaxWidth, setImgMaxWidth] = useState(1200);
  const [imgQuality, setImgQuality] = useState(0.8);
  const [ocrLang, setOcrLang] = useState("eng");
  const [ocrPreprocessMode, setOcrPreprocessMode] = useState("enhanced");
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef(null);

  // Global paste handler: Ctrl+V anywhere on the page pastes clipboard image
  useEffect(() => {
    async function handlePaste(e) {
      if (loading || ocrRunning) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          setFileName(`pasted-image.${item.type.split("/")[1] || "png"}`);
          setError(null);
          setLoading(true);
          try {
            await handleImageImport(file);
          } catch (err) {
            setError(`Failed to read pasted image: ${err.message}`);
          } finally {
            setLoading(false);
          }
          break;
        }
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [loading, ocrRunning]);

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  async function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    if (loading || ocrRunning) return;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImg = isImageFile(file);
    if (!isPdf && !isImg) {
      setError("Please drop a PDF or image file.");
      return;
    }
    setFileName(file.name);
    setError(null);
    setLoading(true);
    try {
      if (isImg) {
        await handleImageImport(file);
      } else {
        await handlePdfImport(file);
      }
    } catch (err) {
      setError(`Failed to import file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp", "image/tiff"];

  function isImageFile(file) {
    return IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(file.name);
  }

  async function handleFileChange(event) {
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImg = isImageFile(file);

    if (!isPdf && !isImg) {
      setError("Please select a PDF or image file (JPG, PNG, WEBP, BMP).");
      return;
    }

    setFileName(file.name);
    setLoading(true);

    try {
      if (isImg) {
        await handleImageImport(file);
      } else {
        await handlePdfImport(file);
      }
    } catch (err) {
      console.error("File import failed:", err);
      setError(
        err?.message
          ? `Failed to import file: ${err.message}`
          : "Failed to import file. Please check the file and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePdfImport(file) {
    const arrayBuffer = await file.arrayBuffer();
    const { text, pageImages, pageTexts } = await extractPdfContent(arrayBuffer);
    // compress/resize images according to current settings
    const compressed = await Promise.all(
      (pageImages || []).map((d) => compressImage(d, imgMaxWidth, imgQuality).catch(() => d)),
    );
    const parsed = parsePdfTextToTemplate(pageTexts.length > 0 ? pageTexts : text, {
      name: `Imported from ${file.name}`,
      category: "Imported PDF",
    });
    parsed.pageTexts = pageTexts;
    parsed.pageImages = (compressed || []).map((src) => ({ src, include: true }));
    setParsedTemplate(parsed);
    const copy = JSON.parse(JSON.stringify(parsed));
    copy.htmlContent = buildHtmlFromTemplate(copy);
    setEditableTemplate(copy);
    setEditorHtml(copy.htmlContent || "");
  }

  async function handleImageImport(file) {
    // Convert image file to data URL
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Compress image
    const compressed = await compressImage(dataUrl, imgMaxWidth, imgQuality).catch(() => dataUrl);

    // Run OCR on the image
    setOcrRunning(true);
    setOcrProgress({ current: 0, total: 1 });
    let ocrText = "";
    try {
      const texts = await runOcrForImages([{ src: compressed, include: true }], ocrLang, () => {
        setOcrProgress({ current: 1, total: 1 });
      });
      ocrText = texts[0] || "";
    } catch (e) {
      console.warn("OCR on image failed:", e);
      ocrText = "";
    } finally {
      setOcrRunning(false);
      setOcrProgress({ current: 0, total: 0 });
    }

    // Parse the OCR text into a template structure
    const parsed = parsePdfTextToTemplate(ocrText, {
      name: `Imported from ${file.name}`,
      category: "Imported Image",
    });
    parsed.pageTexts = [ocrText];
    parsed.pageImages = [{ src: compressed, include: true, ocrText }];
    setParsedTemplate(parsed);
    const copy = JSON.parse(JSON.stringify(parsed));
    copy.htmlContent = buildHtmlFromTemplate(copy);
    setEditableTemplate(copy);
    setEditorHtml(copy.htmlContent || "");
  }
  async function extractPdfContent(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    const pdf = await getDocument({ data }).promise;
    let text = "";
    const images = [];
    const pageTexts = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      text += `${pageText}\n`;
      pageTexts.push(pageText);

      // render page to canvas for image preview
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        images.push(dataUrl);
      } catch {
        // ignore canvas errors
      }
    }

    return { text, pageImages: images, pageTexts };
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildHtmlFromTemplate(tpl) {
    if (!tpl) return "";
    let html = `<div style=\"font-family:Arial,Helvetica,sans-serif;line-height:1.4;\">`;
    html += `<h1 style=\"font-size:20px;margin-bottom:6px;\">${escapeHtml(tpl.name || "Imported Checklist")}</h1>`;
    // insert page images (as full-width previews)
    if (Array.isArray(tpl.pageImages) && tpl.pageImages.length) {
      tpl.pageImages.forEach((img) => {
        const src = typeof img === "string" ? img : img.src;
        if (!src) return;
        html += `<div style=\"margin:6px 0;text-align:center;\">`;
        html += `<img src=\"${src}\" style=\"max-width:100%;height:auto;\"/>`;
        if (img.ocrText) {
          html += `<div style=\"white-space:pre-wrap;margin-top:6px;text-align:left;\">${escapeHtml(img.ocrText)}</div>`;
        }
        html += `</div>`;
      });
    }
    (tpl.sections ?? []).forEach((s) => {
      html += `<h2 style=\"font-size:14px;margin-top:10px;margin-bottom:4px;\">${escapeHtml(s.sectionName || "Section")}</h2>`;
      html += `<ul style=\"margin-left:18px;\">`;
      (s.items ?? []).forEach((it) => {
        html += `<li>${escapeHtml(it.question || "")}</li>`;
      });
      html += `</ul>`;
    });
    html += `</div>`;
    return html;
  }

  const [editorHtml, setEditorHtml] = useState("");

  function handleEditorUpdate(html) {
    setEditorHtml(html);
    setEditableTemplate((prev) => ({ ...prev, htmlContent: html }));
  }

  function compressImage(dataUrl, maxWidth, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          const out = canvas.toDataURL("image/jpeg", Number(quality));
          resolve(out);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function insertPageImage(idx) {
    const list = (editableTemplate?.pageImages) || [];
    const entry = list[idx];
    const src = entry?.src || entry;
    if (!src) return;
    if (editorRef.current?.addImageFromDataUrl) {
      editorRef.current.addImageFromDataUrl(src);
    }
  }

  function updatePageOcrText(idx, text) {
    setEditableTemplate((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || {}));
      copy.pageImages = copy.pageImages || [];
      copy.pageImages[idx] = { ...(copy.pageImages[idx] || {}), ocrText: text };
      copy.htmlContent = buildHtmlFromTemplate(copy);
      return copy;
    });
  }

  async function handleRunOcr() {
    if (!editableTemplate?.pageImages?.length) return;
    setOcrRunning(true);
    setOcrProgress({ current: 0, total: editableTemplate.pageImages.length });
    try {
      const texts = await runOcrForImages(editableTemplate.pageImages, ocrLang, (i) => setOcrProgress({ current: i + 1, total: editableTemplate.pageImages.length }));
      setEditableTemplate((prev) => {
        const copy = JSON.parse(JSON.stringify(prev || {}));
        copy.pageImages = (copy.pageImages || []).map((p, i) => ({ ...(typeof p === 'object' ? p : { src: p }), ocrText: texts[i] || '', include: (p.include ?? true) }));
        copy.pageImageOcrTexts = texts;
        copy.htmlContent = buildHtmlFromTemplate(copy);
        return copy;
      });
    } catch (e) {
      console.error('OCR error', e);
      setError('OCR failed. See console for details.');
    } finally {
      setOcrRunning(false);
      setOcrProgress({ current: 0, total: 0 });
    }
  }

  function preprocessImage(dataUrl, mode) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          data[i] = data[i + 1] = data[i + 2] = gray;
          if (mode === 'enhanced') {
            const threshold = gray > 140 ? 255 : 0;
            data[i] = data[i + 1] = data[i + 2] = threshold;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        try {
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function extractTableFromOcrText(text) {
    const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return '';

    const candidateLines = lines.filter((line) => /\|/.test(line) || /\t/.test(line) || /\s{2,}/.test(line));
    const tableLines = candidateLines.length ? candidateLines : lines.filter((line) => /\s{2,}/.test(line));
    if (!tableLines.length) return 'No table-like structure detected. Please edit manually.';

    const normalizeCells = (cells) => cells.map((cell) => String(cell || '').replace(/\s+/g, ' ').trim());

    const splitByPipe = (line) => line.split('|').map((cell) => cell.trim()).filter((cell) => cell.length > 0);
    const splitByTab = (line) => line.split('\t').map((cell) => cell.trim()).filter((cell) => cell.length > 0);
    const splitBySpaces = (line) => line.split(/\s{2,}/).map((cell) => cell.trim()).filter((cell) => cell.length > 0);

    const getColumnBoundaries = (inputs) => {
      const positions = [];
      for (const line of inputs) {
        const re = /\s{2,}/g;
        let match;
        while ((match = re.exec(line)) !== null) {
          positions.push(match.index + Math.floor(match[0].length / 2));
        }
      }
      if (!positions.length) return null;
      positions.sort((a, b) => a - b);
      const groups = [];
      let currentGroup = [positions[0]];
      for (let i = 1; i < positions.length; i += 1) {
        if (positions[i] - currentGroup[currentGroup.length - 1] <= 4) {
          currentGroup.push(positions[i]);
        } else {
          groups.push(currentGroup);
          currentGroup = [positions[i]];
        }
      }
      groups.push(currentGroup);
      return groups.map((group) => Math.round(group.reduce((sum, value) => sum + value, 0) / group.length));
    };

    const sliceColumns = (line, boundaries) => {
      if (!boundaries || !boundaries.length) return splitBySpaces(line);
      const columns = [];
      let start = 0;
      for (const boundary of boundaries) {
        columns.push(line.slice(start, boundary).trim());
        start = boundary;
      }
      columns.push(line.slice(start).trim());
      return columns.filter((cell) => cell.length > 0);
    };

    const hasPipe = tableLines.every((line) => /\|/.test(line));
    const hasTab = tableLines.every((line) => /\t/.test(line));
    const boundaries = !hasPipe && !hasTab ? getColumnBoundaries(tableLines) : null;

    const rows = tableLines.map((line) => {
      let cells = [];
      if (hasPipe || /\|/.test(line)) {
        cells = splitByPipe(line);
      } else if (hasTab || /\t/.test(line)) {
        cells = splitByTab(line);
      } else if (boundaries && boundaries.length) {
        cells = sliceColumns(line, boundaries);
      } else {
        cells = splitBySpaces(line);
      }
      return normalizeCells(cells);
    }).filter((row) => row.length > 1);

    if (!rows.length) return 'No table-like structure detected. Please edit manually.';

    const maxColumns = Math.max(...rows.map((row) => row.length));
    const normalizedRows = rows.map((row) => [...row, ...Array(maxColumns - row.length).fill('')]);
    return normalizedRows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  }

  function handleExtractTable(idx) {
    const entry = editableTemplate?.pageImages?.[idx];
    const text = (entry && entry.ocrText) || '';
    const tableResult = extractTableFromOcrText(text);
    updatePageOcrText(idx, tableResult);
  }

  function removePageImage(idx) {
    setEditableTemplate((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || {}));
      copy.pageImages = copy.pageImages || [];
      copy.pageImages.splice(idx, 1);
      return copy;
    });
  }

  function toggleIncludePageImage(idx) {
    setEditableTemplate((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || {}));
      copy.pageImages = copy.pageImages || [];
      const entry = copy.pageImages[idx];
      if (typeof entry === "object") {
        entry.include = !entry.include;
      } else {
        copy.pageImages[idx] = { src: entry, include: false };
      }
      return copy;
    });
  }

  async function runOcrForImages(pageImageObjects = [], lang = 'eng', progressCb = () => {}) {
    if (!pageImageObjects || !pageImageObjects.length) return [];
    const worker = await createWorker({ logger: (m) => {} });
    await worker.load();
    try {
      await worker.loadLanguage(lang);
      await worker.initialize(lang);
    } catch (e) {
      console.warn('Failed to load/initialize Tesseract language', lang, e);
    }
    const results = [];
    for (let i = 0; i < pageImageObjects.length; i += 1) {
      const src = pageImageObjects[i]?.src || pageImageObjects[i];
      try {
        const cleanedSrc = await preprocessImage(src, ocrPreprocessMode);
        const { data: { text } } = await worker.recognize(cleanedSrc);
        results.push(text || '');
      } catch (e) {
        console.error('OCR page error', e);
        results.push('');
      }
      progressCb(i + 1);
    }
    await worker.terminate();
    return results;
  }

  async function handleSaveTemplate() {
    if (!editableTemplate) return;
    setLoading(true);
    try {
      await saveParsedPdfTemplate(editableTemplate);
      navigate("/checklist");
    } catch (err) {
      console.error("Save template failed:", err);
      setError(err?.message ? `Save failed: ${err.message}` : "Failed to save template.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenHtmlPreview() {
    const html = buildHtmlFromTemplate(editableTemplate || parsedTemplate);
    setPreviewHtml(`<!doctype html><html><head><meta charset=\"utf-8\"><title>Editable Preview</title></head><body><div contenteditable=\"true\" style=\"padding:20px;max-width:800px;margin:0 auto;\">${html}</div><script>document.title=document.querySelector('div[contenteditable]').innerText.split('\n')[0]||document.title;</script></body></html>`);
    setShowPreview(true);
    // Try opening in a new tab as well; if blocked, the in-page modal will show instead.
    try {
      const win = window.open();
      if (win) {
        win.document.open();
        win.document.write(previewHtml || (`<!doctype html><html><head><meta charset=\"utf-8\"><title>Editable Preview</title></head><body><div contenteditable=\"true\" style=\"padding:20px;max-width:800px;margin:0 auto;\">${html}</div></body></html>`));
        win.document.close();
      }
    } catch (e) {
      // ignore popup errors — modal is available
    }
  }

  function closePreview() {
    setShowPreview(false);
    setPreviewHtml("");
  }

  function openPreviewInTab() {
    try {
      const win = window.open();
      if (!win) return;
      win.document.open();
      win.document.write(previewHtml);
      win.document.close();
    } catch (e) {
      console.error("Failed to open preview in new tab:", e);
      alert("Unable to open a new tab. Your browser may be blocking popups.");
    }
  }

  async function copyPreviewHtml() {
    try {
      await navigator.clipboard.writeText(previewHtml);
      alert("HTML copied to clipboard.");
    } catch (e) {
      console.error("Copy failed:", e);
      alert("Unable to copy HTML to clipboard.");
    }
  }

  function updateTemplateName(value) {
    setEditableTemplate((prev) => ({ ...(prev || {}), name: value }));
  }

  function updateSectionName(idx, value) {
    setEditableTemplate((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || {}));
      copy.sections = copy.sections || [];
      copy.sections[idx] = copy.sections[idx] || { sectionName: "", items: [] };
      copy.sections[idx].sectionName = value;
      return copy;
    });
  }

  function updateItemText(sIdx, iIdx, value) {
    setEditableTemplate((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || {}));
      copy.sections = copy.sections || [];
      copy.sections[sIdx] = copy.sections[sIdx] || { sectionName: "", items: [] };
      copy.sections[sIdx].items = copy.sections[sIdx].items || [];
      copy.sections[sIdx].items[iIdx] = copy.sections[sIdx].items[iIdx] || { question: "" };
      copy.sections[sIdx].items[iIdx].question = value;
      return copy;
    });
  }

  function addItem(sIdx) {
    setEditableTemplate((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || {}));
      copy.sections = copy.sections || [];
      copy.sections[sIdx] = copy.sections[sIdx] || { sectionName: "", items: [] };
      copy.sections[sIdx].items = copy.sections[sIdx].items || [];
      copy.sections[sIdx].items.push({ question: "" });
      return copy;
    });
  }

  function removeItem(sIdx, iIdx) {
    setEditableTemplate((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || {}));
      copy.sections = copy.sections || [];
      copy.sections[sIdx] = copy.sections[sIdx] || { sectionName: "", items: [] };
      copy.sections[sIdx].items = copy.sections[sIdx].items || [];
      copy.sections[sIdx].items.splice(iIdx, 1);
      return copy;
    });
  }

  function addSection() {
    setEditableTemplate((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || {}));
      copy.sections = copy.sections || [];
      copy.sections.push({ sectionName: `Section ${copy.sections.length + 1}`, items: [] });
      return copy;
    });
  }

  function removeSection(sIdx) {
    setEditableTemplate((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || {}));
      copy.sections = copy.sections || [];
      copy.sections.splice(sIdx, 1);
      return copy;
    });
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-navy-800 hover:text-navy-600"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-800 text-white">
            <FilePlus2 size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Import Checklist from PDF or Image</h1>
            <p className="text-sm text-muted">
              Upload a checklist PDF or photo/image — the app will extract text automatically using OCR.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-ink">PDF or Image file</label>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/bmp,image/tiff"
            onChange={handleFileChange}
            disabled={loading || ocrRunning}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
          {fileName && <p className="text-sm text-muted">Selected: {fileName}</p>}
          {error && <p className="text-sm text-danger-600">{error}</p>}

          <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-100 text-navy-800">
                <FilePlus2 size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">PDF Documents</p>
                <p className="text-xs text-muted">Text is extracted directly from PDF structure.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Image size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Images (JPG, PNG, WEBP)</p>
                <p className="text-xs text-muted">Text is read from photos using OCR technology automatically.</p>
              </div>
            </div>
          </div>

          {/* Paste / Drag-and-Drop zone */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-7 px-5 text-center transition-colors ${
              isDragOver
                ? "border-teal-500 bg-teal-50"
                : "border-border bg-surface hover:border-navy-400"
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-100 text-navy-700">
              <Image size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">
                {isDragOver ? "Drop it here!" : "Paste or drag image here"}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Copy a screenshot and press <kbd className="rounded border border-border bg-white px-1.5 py-0.5 font-mono text-xs shadow-sm">Ctrl+V</kbd> anywhere, or drag &amp; drop an image file
              </p>
            </div>
          </div>

          {ocrRunning && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-teal-800">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Reading image with OCR… {ocrProgress.total > 0 ? `(${ocrProgress.current}/${ocrProgress.total})` : ""}
              </div>
              <p className="mt-1 text-xs text-teal-700">This may take a moment. Please wait.</p>
            </div>
          )}

          <button
            onClick={() => document.querySelector("input[type=file]")?.click()}
            className="inline-flex items-center gap-2 rounded-md bg-navy-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-60"
            disabled={loading || ocrRunning}
          >
            {loading ? "Importing…" : ocrRunning ? "Reading image…" : "Choose PDF or Image"}
          </button>
        </div>
      </div>
      {editableTemplate && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2">
            <h3 className="text-sm font-bold uppercase text-navy-800">Preview & Edit Template</h3>
            <div className="flex gap-2">
              <button
                onClick={handleOpenHtmlPreview}
                className="rounded-md border border-navy-800 px-3 py-1 text-sm text-navy-800 hover:bg-navy-50"
              >
                Open HTML Preview
              </button>
              <button
                onClick={() => downloadDocxFromTemplate(editableTemplate || parsedTemplate, `${(editableTemplate?.name || parsedTemplate?.name || 'imported-checklist').replace(/\s+/g,'_')}.docx`)}
                className="rounded-md border border-navy-800 px-3 py-1 text-sm text-navy-800 hover:bg-navy-50"
              >
                Export DOCX
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={loading}
                className="rounded-md bg-navy-800 px-3 py-1 text-sm font-bold text-white hover:bg-navy-700"
              >
                Save as Template
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-ink">Template Name</label>
            <input
              value={editableTemplate.name || ""}
              onChange={(e) => updateTemplateName(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-ink">Rich Editor</label>
            <RichEditor ref={editorRef} content={editorHtml} onUpdate={handleEditorUpdate} />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-ink">Image & OCR Settings</label>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted">Max width</label>
                <input
                  type="number"
                  value={imgMaxWidth}
                  onChange={(e) => setImgMaxWidth(Number(e.target.value || 1200))}
                  className="w-24 rounded-md border border-border px-2 py-1 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted">Quality</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={imgQuality}
                  onChange={(e) => setImgQuality(Number(e.target.value))}
                />
                <div className="text-sm text-muted">{Math.round(imgQuality * 100)}%</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted">OCR Lang</label>
                <select value={ocrLang} onChange={(e) => setOcrLang(e.target.value)} className="rounded-md border border-border px-2 py-1 text-sm">
                  <option value="eng">English</option>
                  <option value="spa">Spanish</option>
                  <option value="fra">French</option>
                  <option value="deu">German</option>
                  <option value="ita">Italian</option>
                  <option value="por">Portuguese</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted">Preprocess</label>
                <select value={ocrPreprocessMode} onChange={(e) => setOcrPreprocessMode(e.target.value)} className="rounded-md border border-border px-2 py-1 text-sm">
                  <option value="enhanced">Enhanced</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
              <button onClick={handleRunOcr} disabled={ocrRunning} className="rounded-md bg-navy-800 px-3 py-1 text-sm font-bold text-white">
                {ocrRunning ? `Running OCR ${ocrProgress.current}/${ocrProgress.total}` : 'Run OCR'}
              </button>
            </div>
          </div>

          {Array.isArray(editableTemplate.pageImages) && editableTemplate.pageImages.length > 0 && (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-semibold text-ink">Page-by-page OCR</label>
              <div className="space-y-4">
                {editableTemplate.pageImages.map((entry, idx) => {
                  const page = typeof entry === "string" ? { src: entry, include: true, ocrText: "" } : entry;
                  return (
                    <div key={idx} className="rounded border border-border bg-white p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-navy-800">Page {idx + 1}</div>
                          <div className="text-xs text-muted">OCR text and page controls</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => insertPageImage(idx)} className="rounded-md border px-2 py-1 text-sm">Insert Image</button>
                          <button onClick={() => handleExtractTable(idx)} className="rounded-md border px-2 py-1 text-sm">Extract Table</button>
                          <button onClick={() => toggleIncludePageImage(idx)} className="rounded-md border px-2 py-1 text-sm">
                            {page.include ? 'Exclude' : 'Include'}
                          </button>
                          <button onClick={() => removePageImage(idx)} className="rounded-md border px-2 py-1 text-sm text-danger-600">Remove</button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-[200px_1fr]">
                        <img src={page.src} alt={`page-${idx + 1}`} className="w-full rounded border border-border object-contain md:h-60" />
                        <textarea
                          value={page.ocrText || ""}
                          onChange={(e) => updatePageOcrText(idx, e.target.value)}
                          className="h-60 w-full rounded-md border border-border bg-surface p-3 text-sm leading-relaxed"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(editableTemplate.sections ?? []).map((section, sIdx) => (
            <div key={sIdx} className="mb-4 rounded-md border border-border bg-white p-3">
              <div className="flex items-center justify-between">
                <input
                  value={section.sectionName}
                  onChange={(e) => updateSectionName(sIdx, e.target.value)}
                  placeholder={`Section ${sIdx + 1} name`}
                  className="flex-1 border-none bg-transparent text-sm font-bold uppercase text-navy-800 outline-none"
                />
                <button
                  onClick={() => removeSection(sIdx)}
                  className="ml-3 text-sm text-danger-600"
                >
                  Remove
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {(section.items ?? []).map((item, iIdx) => (
                  <div key={iIdx} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-bold text-navy-800">{iIdx + 1}</span>
                    <input
                      value={item.question}
                      onChange={(e) => updateItemText(sIdx, iIdx, e.target.value)}
                      placeholder="Checklist item"
                      className="flex-1 rounded-md border border-border bg-white px-3 py-2.5 text-sm"
                    />
                    <button
                      onClick={() => removeItem(sIdx, iIdx)}
                      className="text-muted hover:text-danger-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addItem(sIdx)}
                  className="mt-2 flex items-center gap-2 rounded-md border-2 border-dashed border-border py-2 px-3 text-sm font-semibold text-navy-700"
                >
                  + Add Item
                </button>
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <button
              onClick={addSection}
              className="rounded-md border border-border px-3 py-1 text-sm text-ink"
            >
              + Add Section
            </button>
          </div>
        </section>
      )}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
          <div className="absolute inset-0 bg-black/40" onClick={closePreview} />
          <div className="relative z-10 w-full max-w-4xl rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-border p-3">
              <div className="font-bold">Editable HTML Preview</div>
              <div className="flex gap-2">
                <button onClick={copyPreviewHtml} className="rounded-md border px-2 py-1 text-sm">Copy HTML</button>
                <button onClick={openPreviewInTab} className="rounded-md border px-2 py-1 text-sm">Open in New Tab</button>
                <button onClick={closePreview} className="rounded-md bg-navy-800 px-3 py-1 text-sm font-bold text-white">Close</button>
              </div>
            </div>
            <iframe
              title="Editable Preview"
              srcDoc={previewHtml}
              className="w-full h-[70vh] border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
