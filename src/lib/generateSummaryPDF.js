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

export function buildSummaryPDFDoc(reports) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageW = 297;
  const margin = 14;

  // Title: 1.1 SUMMARY OF THE WORK
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 30, 55);
  doc.text("1.1  SUMMARY OF THE WORK", margin, 18);

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

  // Summary Paragraphs
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);

  const p1 = `A total of ${totalDoors} doors have been installed with the access door system at the ${customerName} premises, comprising ${totalDevices} access control devices in total. This maintenance is carried out from ${startDateStr} to ${endDateStr}.`;
  const splitP1 = doc.splitTextToSize(p1, pageW - margin * 2);
  doc.text(splitP1, margin, 26);

  let curY = 26 + splitP1.length * 4.5 + 2;
  doc.text(
    "Table 1 summarizes the maintenance work for the access door system.",
    margin,
    curY,
  );

  curY += 8;

  // Table 1 Caption
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(
    "Table 1: Summary of Maintenance Work for Access Door System",
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
      fontSize: 8.5,
    },
    bodyStyles: {
      textColor: [30, 30, 30],
      fontSize: 8,
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "left", cellWidth: 48, fontStyle: "bold" },
      2: { halign: "center", cellWidth: 24 },
      3: { halign: "left", cellWidth: 42 },
      4: { halign: "left", cellWidth: 42 },
      5: { halign: "left", cellWidth: 45 },
      6: { halign: "left", cellWidth: 56 },
    },
    margin: { left: margin, right: margin },
  });

  return doc;
}

export function generateSummaryPDF(reports, filename = "Summary_Report.pdf") {
  const doc = buildSummaryPDFDoc(reports);
  doc.save(filename);
}

export function getSummaryPDFBlobUrl(reports) {
  const doc = buildSummaryPDFDoc(reports);
  return doc.output("bloburl");
}
