import { instantiateSectionsFromTemplate, DEFAULT_COMPANY } from "./defaultTemplates.js";
import { createChecklistTemplate } from "./reportsApi.js";

function normalizeSection(section) {
  return {
    sectionName: String(section.sectionName ?? section.title ?? "Untitled Section").trim(),
    items: (section.items ?? section.questions ?? section.rows ?? [])
      .map((item) => ({ question: String(item.question ?? item.text ?? "").trim() }))
      .filter((item) => item.question.length > 0),
  };
}

export function buildChecklistTemplateFromParsedPdf(parsedPdfTemplate = {}) {
  const {
    name = "Imported PDF Checklist",
    category = "Imported",
    locationDoor = "",
    assignedTechnician = "",
    customer,
    sections = [],
  } = parsedPdfTemplate;

  const template = {
    name: String(name).trim() || "Imported PDF Checklist",
    category: String(category).trim() || "Imported",
    locationDoor: String(locationDoor).trim(),
    assignedTechnician: String(assignedTechnician).trim(),
    sections: Array.isArray(sections)
      ? sections.map(normalizeSection).filter((section) => section.sectionName || section.items.length)
      : [],
  };

  if (customer) {
    template.customer = { ...customer };
  }

  return template;
}

export function parsePdfTextToTemplate(pdfTextOrPages = "", options = {}) {
  const pages = Array.isArray(pdfTextOrPages) ? pdfTextOrPages : [String(pdfTextOrPages || "")];
  const sections = [];

  function parseLinesIntoSections(lines, defaultSectionName) {
    const pageSections = [];
    let current = { sectionName: defaultSectionName, items: [] };

    for (const line of lines) {
      const normalized = line
        .trim()
        .replace(/^\|\s*/, "")
        .replace(/\s*\|\s*$/, "")
        .trim();
      if (!normalized) continue;
      if (/^page\s*\d+/i.test(normalized)) {
        continue;
      }
      const sectionMatch = normalized.match(/^(?:section|part|chapter|page)\s*[:\-]?\s*(.+)$/i)
        || normalized.match(/^[A-Z][.)]\s+(.+)$/);
      if (sectionMatch) {
        if (current.items.length) pageSections.push(current);
        current = {
          sectionName: sectionMatch[1].trim() || `Section ${pageSections.length + 1}`,
          items: [],
        };
        continue;
      }

      if (/^(yes|no)\s*[:\-]/i.test(normalized)) {
        continue;
      }

      if (/^\d+$/.test(normalized)) {
        continue;
      }
      const question = normalized
        .replace(/^\d+(?:\s*[|.)\-:]|\s+)\s*/, "")
        .replace(/\s*\|\s*$/, "")
        .trim();
      const itemMatch = question.match(/^(?:[•\*\-+]\s+)/);
      if (itemMatch || question.length > 3) {
        current.items.push({ question });
      }
    }

    if (current.items.length) {
      pageSections.push(current);
    }
    return pageSections;
  }

  pages.forEach((pageText, pageIndex) => {
    const rawLines = String(pageText || "").split(/\r?\n/).map((line) => line.trim());
    const lines = rawLines.filter((line) => line.length > 0);
    if (!lines.length) return;

    const pageSections = parseLinesIntoSections(lines, `Page ${pageIndex + 1}`);
    if (pageSections.length) {
      sections.push(...pageSections);
    } else {
      sections.push({
        sectionName: `Page ${pageIndex + 1}`,
        items: lines.map((line) => ({ question: line })),
      });
    }
  });

  if (!sections.length) {
    sections.push({ sectionName: "Imported PDF", items: [{ question: "No recognizable checklist text found." }] });
  }

  return buildChecklistTemplateFromParsedPdf({
    name: options.name ?? "Imported PDF Checklist",
    category: options.category ?? "Imported",
    locationDoor: options.locationDoor ?? "",
    assignedTechnician: options.assignedTechnician ?? "",
    customer: options.customer,
    sections,
  });
}

export async function saveParsedPdfTextTemplate(pdfText, options = {}) {
  const parsedTemplate = parsePdfTextToTemplate(pdfText, options);
  return saveParsedPdfTemplate(parsedTemplate);
}

export function buildReportPayloadFromTemplate(template, overrides = {}) {
  return {
    locationDoor: overrides.locationDoor ?? template.locationDoor ?? "-",
    leadTechnician: overrides.leadTechnician ?? template.assignedTechnician ?? "Unassigned",
    dateOfService: overrides.dateOfService ?? new Date().toISOString().slice(0, 10),
    templateId: template.id ?? undefined,
    templateName: template.name,
    serviceProvider: overrides.serviceProvider ?? template.serviceProvider ?? DEFAULT_COMPANY,
    customer: overrides.customer ?? template.customer ?? { name: "-", address: "", logo: null },
    sections: instantiateSectionsFromTemplate(template),
    ...overrides,
  };
}

export async function saveParsedPdfTemplate(parsedPdfTemplate) {
  const templateData = buildChecklistTemplateFromParsedPdf(parsedPdfTemplate);
  // Preserve full HTML content and page images if available for richer editing later
  if (parsedPdfTemplate.htmlContent) {
    templateData.htmlContent = parsedPdfTemplate.htmlContent;
  }
  if (parsedPdfTemplate.pageImages) {
    templateData.pageImages = parsedPdfTemplate.pageImages;
  }
  if (Array.isArray(parsedPdfTemplate.pageTexts) && parsedPdfTemplate.pageTexts.length) {
    templateData.pageTexts = parsedPdfTemplate.pageTexts;
  }
  // Also persist OCR text separately for easier search and editing
  if (Array.isArray(parsedPdfTemplate.pageImages)) {
    const ocrTexts = parsedPdfTemplate.pageImages.map((p) => (p && p.ocrText) || "");
    if (ocrTexts.some((t) => t && t.length > 0)) {
      templateData.pageImageOcrTexts = ocrTexts;
    }
  }
  return createChecklistTemplate(templateData);
}
