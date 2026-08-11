import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from "docx";

function paragraph(text, options = {}) {
  return new Paragraph({
    children: [new TextRun({ text: String(text ?? ""), ...options })],
  });
}

export async function buildDocxBlobFromTemplate(template) {
  const doc = new Document({ sections: [] });

  const children = [];
  children.push(
    new Paragraph({
      text: template.name ?? "Imported Checklist",
      heading: HeadingLevel.HEADING_1,
    }),
  );

  (template.sections ?? []).forEach((s) => {
    children.push(new Paragraph({ text: s.sectionName ?? "Section", heading: HeadingLevel.HEADING_2 }));
    (s.items ?? []).forEach((it) => {
      children.push(paragraph(`• ${it.question ?? ""}`));
    });
  });

  // If HTML content provided, add it as plain paragraphs (fallback)
  if ((!template.sections || template.sections.length === 0) && template.htmlContent) {
    const text = stripHtml(template.htmlContent);
    text.split(/\n+/).forEach((line) => {
      if (line.trim()) children.push(paragraph(line.trim()));
    });
  }

  // Embed any pageImages (data URLs or {src, include}) if present
  if (Array.isArray(template.pageImages) && template.pageImages.length) {
    for (const entry of template.pageImages) {
      try {
        const include = typeof entry === "object" ? (entry.include !== false) : true;
        const dataUrl = typeof entry === "string" ? entry : (entry.src || "");
        if (!include || !dataUrl) continue;
        const arr = dataURLToUint8Array(dataUrl);
        const img = new ImageRun({ data: arr, transformation: { width: 500, height: 350 } });
        children.push(new Paragraph({ children: [img] }));
      } catch {
        // ignore image errors
      }
    }
  }

  doc.addSection({ children });

  const blob = await Packer.toBlob(doc);
  return blob;
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

function dataURLToUint8Array(dataURL) {
  const parts = dataURL.split(",");
  const meta = parts[0];
  const base64 = parts[1];
  const raw = atob(base64);
  const u8 = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) u8[i] = raw.charCodeAt(i);
  return u8;
}

export async function downloadDocxFromTemplate(template, filename = "imported-checklist.docx") {
  const blob = await buildDocxBlobFromTemplate(template);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default { buildDocxBlobFromTemplate, downloadDocxFromTemplate };
