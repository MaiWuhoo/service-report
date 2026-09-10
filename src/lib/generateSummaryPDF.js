import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function formatDateDMY(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }
  } catch {}
  return dateStr;
}

export function getSummaryPDFFilename(reports, options = {}) {
  const projectNames = [
    ...new Set(reports.map((r) => r.templateName?.trim()).filter(Boolean)),
  ];
  const systemName =
    projectNames.length === 1
      ? projectNames[0]
      : projectNames.length > 1
        ? projectNames.slice(0, 2).join(" & ")
        : "Work";

  const customerName =
    reports.find((r) => r.customer?.name)?.customer?.name?.trim() || "";

  const dates = reports
    .map((r) => r.dateOfService)
    .filter(Boolean)
    .sort();
  const startDateStr = dates.length > 0 ? formatDateDMY(dates[0]).replace(/\//g, "-") : "";
  const endDateStr = dates.length > 0 ? formatDateDMY(dates[dates.length - 1]).replace(/\//g, "-") : "";

  let datePart = "";
  if (startDateStr && endDateStr) {
    datePart = startDateStr === endDateStr ? startDateStr : `${startDateStr} to ${endDateStr}`;
  }

  const parts = ["Summary Report"];
  if (systemName) parts.push(systemName);
  if (customerName && customerName !== "TLP") parts.push(customerName);
  if (datePart) parts.push(datePart);

  let baseName = parts.join(" - ");
  baseName = baseName.replace(/[\\/:*?"<>|]/g, "_").trim();
  return `${baseName}.pdf`;
}

export function buildSummaryPDFDoc(reports, options = {}) {
  const orientation = options.orientation === "portrait" ? "portrait" : "landscape";
  const isPortrait = orientation === "portrait";

  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  const pageW = isPortrait ? 210 : 297;
  const pageH = isPortrait ? 297 : 210;
  const margin = isPortrait ? 10 : 14;

  // Title: 1.1 SUMMARY OF THE WORK
  doc.setFont("helvetica", "bold");
  doc.setFontSize(isPortrait ? 13 : 14);
  doc.setTextColor(20, 30, 55);
  doc.text("1.1  SUMMARY OF THE WORK", margin, isPortrait ? 16 : 18);

  // Collect stats
  const totalDoors = reports.length;
  const totalDevices = totalDoors * 2;

  const dates = reports
    .map((r) => r.dateOfService)
    .filter(Boolean)
    .sort();
  const startDateStr = dates.length > 0 ? formatDateDMY(dates[0]) : "-";
  const endDateStr =
    dates.length > 0 ? formatDateDMY(dates[dates.length - 1]) : "-";

  const customerName =
    reports.find((r) => r.customer?.name)?.customer?.name || "TLP";

  // Derive system/template name
  const projectNames = [
    ...new Set(reports.map((r) => r.templateName?.trim()).filter(Boolean)),
  ];
  const systemName =
    projectNames.length === 1
      ? projectNames[0]
      : projectNames.length > 1
        ? projectNames.join(" & ")
        : "Access Door System";

  const sysLabel = systemName.toLowerCase().includes("system")
    ? systemName
    : `${systemName} System`;

  // Set PDF metadata so browser PDF viewers use this title when saving/downloading
  const defaultFilename = getSummaryPDFFilename(reports, options);
  const finalFilename = options.filename || defaultFilename;
  const pdfTitle = finalFilename.replace(/\.pdf$/i, "");
  doc.setProperties({
    title: pdfTitle,
    subject: `Summary of Maintenance Work for ${sysLabel}`,
    author: customerName,
    creator: "Service Report System",
  });

  // Summary Paragraphs
  doc.setFont("helvetica", "normal");
  doc.setFontSize(isPortrait ? 9 : 10);
  doc.setTextColor(40, 40, 40);

  const p1 = `A total of ${totalDoors} doors have been installed with the ${sysLabel} at the ${customerName} premises, comprising ${totalDevices} access control devices in total. This maintenance is carried out from ${startDateStr} to ${endDateStr}.`;
  const splitP1 = doc.splitTextToSize(p1, pageW - margin * 2);
  const p1StartY = isPortrait ? 23 : 26;
  doc.text(splitP1, margin, p1StartY);

  let curY = p1StartY + splitP1.length * (isPortrait ? 4.2 : 4.5) + 2;
  doc.text(
    `Table 1 summarizes the maintenance work for the ${sysLabel}.`,
    margin,
    curY,
  );

  curY += isPortrait ? 7 : 8;

  // Table 1 Caption
  doc.setFont("helvetica", "normal");
  doc.setFontSize(isPortrait ? 9 : 9.5);
  doc.text(
    `Table 1: Summary of Maintenance Work for ${sysLabel}`,
    pageW / 2,
    curY,
    { align: "center" },
  );

  curY += 4;

  // Prepare table data
  const tableRows = reports.map((r, index) => {
    const no = index + 1;
    const location = (r.locationDoor || r.templateName || "-").toUpperCase();
    const date = formatDateDMY(r.dateOfService) || "-";

    const sections = r.sections || [];

    // Door IN section
    const inSection =
      sections.find((s) => /in/i.test(s.sectionName || "")) || sections[0];
    let inText = "OK";
    if (inSection && Array.isArray(inSection.items)) {
      const issues = inSection.items.filter(
        (i) =>
          (i.remark && i.remark.trim() !== "") ||
          i.answer === "No" ||
          i.answer === "Fail",
      );
      if (issues.length > 0) {
        inText = issues.map((i) => `• ${i.remark || i.question}`).join("\n");
      }
    }

    // Door OUT section
    const outSection =
      sections.find((s) => /out/i.test(s.sectionName || "")) || sections[1];
    let outText = "OK";
    if (outSection && Array.isArray(outSection.items)) {
      const issues = outSection.items.filter(
        (i) =>
          (i.remark && i.remark.trim() !== "") ||
          i.answer === "No" ||
          i.answer === "Fail",
      );
      if (issues.length > 0) {
        outText = issues.map((i) => `• ${i.remark || i.question}`).join("\n");
      }
    }

    // General section
    const genSection =
      sections.find((s) => /general/i.test(s.sectionName || "")) ||
      sections[2];
    let genText = "OK";
    if (genSection && Array.isArray(genSection.items)) {
      const issues = genSection.items.filter(
        (i) =>
          (i.remark && i.remark.trim() !== "") ||
          i.answer === "No" ||
          i.answer === "Fail",
      );
      if (issues.length > 0) {
        genText = issues.map((i) => `• ${i.remark || i.question}`).join("\n");
      }
    }

    // Remark column
    let remarkText = r.additionalRemark?.trim() || "-";
    if (remarkText === "-") {
      const allRemarks = sections
        .flatMap((s) => s.items || [])
        .filter((i) => i.remark && i.remark.trim() !== "")
        .map((i) => i.remark.trim());
      if (allRemarks.length > 0) {
        remarkText = [...new Set(allRemarks)].join(", ");
      }
    }

    return [no, location, date, inText, outText, genText, remarkText];
  });

  const columnStyles = isPortrait
    ? {
        0: { halign: "center", cellWidth: 8 },
        1: { halign: "left", cellWidth: 35, fontStyle: "bold" },
        2: { halign: "center", cellWidth: 18 },
        3: { halign: "left", cellWidth: 28 },
        4: { halign: "left", cellWidth: 28 },
        5: { halign: "left", cellWidth: 32 },
        6: { halign: "left", cellWidth: 41 },
      }
    : {
        0: { halign: "center", cellWidth: 12 },
        1: { halign: "left", cellWidth: 48, fontStyle: "bold" },
        2: { halign: "center", cellWidth: 24 },
        3: { halign: "left", cellWidth: 42 },
        4: { halign: "left", cellWidth: 42 },
        5: { halign: "left", cellWidth: 45 },
        6: { halign: "left", cellWidth: 56 },
      };

  autoTable(doc, {
    startY: curY,
    head: [
      [
        "NO",
        "LOCATION DOOR",
        "DATE",
        "DOOR IN",
        "DOOR OUT",
        "GENERAL",
        "REMARK",
      ],
    ],
    body: tableRows,
    theme: "grid",
    headStyles: {
      fillColor: [198, 217, 241],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      fontSize: isPortrait ? 7.5 : 8.5,
      cellPadding: isPortrait ? 1.5 : 2,
    },
    bodyStyles: {
      textColor: [30, 30, 30],
      fontSize: isPortrait ? 7 : 8,
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      valign: "middle",
      cellPadding: isPortrait ? 1.5 : 2,
    },
    columnStyles,
    margin: { left: margin, right: margin, bottom: 12 },
  });

  // Footer: Page X of Y
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${i} of ${totalPages}`, pageW / 2, pageH - 6, {
      align: "center",
    });
  }

  return doc;
}

export function generateSummaryPDF(reports, filename, options = {}) {
  const resolvedFilename =
    typeof filename === "string" && filename.trim() !== ""
      ? filename
      : getSummaryPDFFilename(reports, options);
  const doc = buildSummaryPDFDoc(reports, { ...options, filename: resolvedFilename });
  doc.save(resolvedFilename);
}

export function getSummaryPDFBlobUrl(reports, options = {}) {
  const filename = getSummaryPDFFilename(reports, options);
  const doc = buildSummaryPDFDoc(reports, { ...options, filename });
  return doc.output("bloburl");
}

export function getSummaryPDFArrayBuffer(reports, options = {}) {
  const filename = getSummaryPDFFilename(reports, options);
  const doc = buildSummaryPDFDoc(reports, { ...options, filename });
  return doc.output("arraybuffer");
}
