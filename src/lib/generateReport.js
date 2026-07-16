import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { imageFormatFromDataUrl } from "./fileUtils";

const PAGE_W = 210; // A4 mm
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;

function drawHeaderBox(doc, report, y) {
  const boxH = 34;
  const colW = CONTENT_W / 2;
  const logoSize = 14;

  doc.setDrawColor(120);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, CONTENT_W, boxH);
  doc.line(MARGIN + colW, y, MARGIN + colW, y + boxH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text("Service Provider:", MARGIN + 2, y + 5);
  doc.text("Cust Name:", MARGIN + colW + 2, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(report.serviceProvider?.name ?? "-", MARGIN + 28, y + 5);
  doc.text(report.customer?.name ?? "-", MARGIN + colW + 22, y + 5);

  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  const provAddr = doc.splitTextToSize(
    report.serviceProvider?.address ?? "",
    colW - 4 - logoSize,
  );
  doc.text(provAddr, MARGIN + 2, y + 10);

  const custAddr = doc.splitTextToSize(
    report.customer?.address ?? "",
    colW - 4 - logoSize,
  );
  doc.text(custAddr, MARGIN + colW + 2, y + 10);

  // Logos, top-right corner of each column
  if (report.serviceProvider?.logo) {
    try {
      doc.addImage(
        report.serviceProvider.logo,
        imageFormatFromDataUrl(report.serviceProvider.logo),
        MARGIN + colW - logoSize - 2,
        y + 2,
        logoSize,
        logoSize,
      );
    } catch {
      // ignore malformed image data
    }
  }
  if (report.customer?.logo) {
    try {
      doc.addImage(
        report.customer.logo,
        imageFormatFromDataUrl(report.customer.logo),
        MARGIN + CONTENT_W - logoSize - 2,
        y + 2,
        logoSize,
        logoSize,
      );
    } catch {
      // ignore malformed image data
    }
  }

  return y + boxH;
}

function drawMetaRow(doc, report, y) {
  const rowH = 8;
  const colW = CONTENT_W / 2;
  doc.rect(MARGIN, y, CONTENT_W, rowH);
  doc.line(MARGIN + colW, y, MARGIN + colW, y + rowH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text("Date of Service:", MARGIN + 2, y + 5.2);
  doc.text("Location Door:", MARGIN + colW + 2, y + 5.2);

  doc.setFont("helvetica", "normal");
  doc.text(String(report.dateOfService ?? "-"), MARGIN + 30, y + 5.2);
  doc.text(String(report.locationDoor ?? "-"), MARGIN + colW + 28, y + 5.2);

  return y + rowH;
}

function drawEngineerRow(doc, report, y) {
  const rowH = 7;
  doc.rect(MARGIN, y, CONTENT_W, rowH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Engineer/ Technician (s):", MARGIN + 2, y + 4.8);
  doc.setFont("helvetica", "normal");
  doc.text(
    String(report.leadTechnician ?? report.engineerName ?? "-"),
    MARGIN + 42,
    y + 4.8,
  );
  return y + rowH;
}

function buildChecklistBody(report) {
  const body = [];
  const photoByRow = new Map(); // body row index -> photo data URL

  (report.sections ?? []).forEach((section) => {
    body.push([
      {
        content: section.sectionName,
        colSpan: 4,
        styles: {
          fontStyle: "italic",
          halign: "center",
          fillColor: [241, 245, 249],
        },
      },
    ]);
    (section.items ?? []).forEach((item, i) => {
      if (item.photo) photoByRow.set(body.length, item.photo);
      body.push([
        String(i + 1),
        item.question,
        (item.answer || "-").toUpperCase(),
        item.remark || "",
      ]);
    });
  });

  return { body, photoByRow };
}

function drawSignatureBlock(
  doc,
  x,
  y,
  w,
  title,
  name,
  dateStr,
  signatureDataUrl,
  stampDataUrl,
) {
  const h = 34;
  doc.setDrawColor(120);
  doc.rect(x, y, w, h);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(title, x + 2, y + 5);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.text("(Sign & Company Cop)", x + 2, y + 9);

  if (signatureDataUrl) {
    try {
      doc.addImage(
        signatureDataUrl,
        imageFormatFromDataUrl(signatureDataUrl),
        x + 2,
        y + 10,
        w - 4,
        14,
      );
    } catch {
      // ignore malformed image data
    }
  }

  if (stampDataUrl) {
    try {
      const stampSize = 16;
      doc.addImage(
        stampDataUrl,
        imageFormatFromDataUrl(stampDataUrl),
        x + w - stampSize - 2,
        y + 8,
        stampSize,
        stampSize,
      );
    } catch {
      // ignore malformed image data
    }
  }

  doc.setDrawColor(180);
  doc.line(x + 2, y + h - 10, x + w - 2, y + h - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(20, 20, 20);
  doc.text(`Name: ${name || "-"}`, x + 2, y + h - 6);
  doc.text(`Date: ${dateStr || "-"}`, x + 2, y + h - 2);
}

/** Builds the jsPDF document without saving it — used for both download and preview. */
export function buildReportDoc(report) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(10, 10, 10);
  doc.text(
    `PREVENTIVE MAINTENANCE SERVICE REPORT${
      report.templateName ? ` - ${report.templateName.toUpperCase()}` : ""
    }`,
    PAGE_W / 2,
    y,
    { align: "center" },
  );
  y += 6;

  y = drawHeaderBox(doc, report, y);
  y = drawMetaRow(doc, report, y);
  y = drawEngineerRow(doc, report, y);

  const { body: checklistBody, photoByRow } = buildChecklistBody(report);
  const THUMB = 16;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["No", "Checklist", "Yes/ No", "Remark"]],
    body: checklistBody,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [120, 120, 120],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 45, valign: "top" },
    },
    didParseCell: (data) => {
      // Reserve extra height in the Remark cell so the thumbnail has room
      // below the text instead of overlapping it.
      if (
        data.section === "body" &&
        data.column.index === 3 &&
        photoByRow.has(data.row.index)
      ) {
        data.cell.styles.minCellHeight = THUMB + 6;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 3) return;
      const photo = photoByRow.get(data.row.index);
      if (!photo) return;
      try {
        doc.addImage(
          photo,
          imageFormatFromDataUrl(photo),
          data.cell.x + 1,
          data.cell.y + data.cell.height - THUMB - 1,
          THUMB,
          THUMB,
          undefined,
          "FAST",
        );
      } catch {
        // ignore malformed image data
      }
    },
  });

  y = doc.lastAutoTable.finalY;

  const remarkH = 20;
  doc.setDrawColor(120);
  doc.rect(MARGIN, y, CONTENT_W, remarkH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Additional Remark:", MARGIN + 2, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const remarkLines = doc.splitTextToSize(
    report.additionalRemark || "",
    CONTENT_W - 4,
  );
  doc.text(remarkLines, MARGIN + 2, y + 10);
  y += remarkH + 6;

  if (y > 250) {
    doc.addPage();
    y = 14;
  }

  const colW = (CONTENT_W - 4) / 2;
  drawSignatureBlock(
    doc,
    MARGIN,
    y,
    colW,
    "Checked by Engineer:",
    report.engineerName || report.leadTechnician,
    report.engineerDate,
    report.engineerSignature,
  );
  drawSignatureBlock(
    doc,
    MARGIN + colW + 4,
    y,
    colW,
    "Verified by Manager/Team:",
    report.reviewedBy,
    report.reviewDate,
    report.managerSignature,
    report.companyStamp,
  );

  return doc;
}

/** Returns a blob URL suitable for <iframe src> preview. Caller should
 *  URL.revokeObjectURL(url) when done with it (e.g. on unmount). */
export function getReportPDFBlobUrl(report) {
  return buildReportDoc(report).output("bloburl");
}

export function generateServiceReportPDF(report) {
  const doc = buildReportDoc(report);
  doc.save(`${report.reportId ?? "service-report"}.pdf`);
}
