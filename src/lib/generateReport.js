import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { imageFormatFromDataUrl } from "./fileUtils";

const PAGE_W = 210; // A4 mm
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;

function drawLogo(doc, dataUrl, x, y, maxSize) {
  try {
    const props = doc.getImageProperties(dataUrl);
    const scale = Math.min(maxSize / props.width, maxSize / props.height, 1);
    const width = props.width * scale;
    const height = props.height * scale;
    doc.addImage(dataUrl, imageFormatFromDataUrl(dataUrl), x, y, width, height);
    return { width, height };
  } catch {
    doc.addImage(dataUrl, imageFormatFromDataUrl(dataUrl), x, y, maxSize, maxSize);
    return { width: maxSize, height: maxSize };
  }
}

function drawHeaderBox(doc, report, y) {
  const boxH = 38;
  const colW = CONTENT_W / 2;
  const logoSize = 16;
  const logoOffset = 3;
  const providerLogoX = MARGIN + logoOffset;
  const customerLogoX = MARGIN + colW + logoOffset;
  const providerTextX = providerLogoX + logoSize + 6;
  const customerTextX = customerLogoX + logoSize + 6;
  const providerTextWidth = colW - (providerTextX - MARGIN) - 10;
  const customerTextWidth = colW - (customerTextX - (MARGIN + colW)) - 10;

  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, CONTENT_W, boxH);
  doc.line(MARGIN + colW, y, MARGIN + colW, y + boxH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text("Service Provider", providerTextX, y + 8);
  doc.text("Customer", customerTextX, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(report.serviceProvider?.name ?? "-", providerTextX, y + 13);
  doc.text(report.customer?.name ?? "-", customerTextX, y + 13);

  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const provAddr = doc.splitTextToSize(
    report.serviceProvider?.address ?? "",
    providerTextWidth,
  );
  doc.text(provAddr, providerTextX, y + 17);

  const custAddr = doc.splitTextToSize(
    report.customer?.address ?? "",
    customerTextWidth,
  );
  doc.text(custAddr, customerTextX, y + 17);

  if (report.serviceProvider?.logo) {
    try {
      drawLogo(doc, report.serviceProvider.logo, providerLogoX, y + logoOffset, logoSize);
    } catch {
      // ignore malformed image data
    }
  }
  if (report.customer?.logo) {
    try {
      drawLogo(doc, report.customer.logo, customerLogoX, y + logoOffset, logoSize);
    } catch {
      // ignore malformed image data
    }
  }

  return y + boxH;
}

function drawMetaRow(doc, report, y, rowH) {
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

function drawEngineerRow(doc, report, y, rowH) {
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
  const photoByRow = new Map(); // body row index -> photo data URL array

  const normalizePhotos = (item) => {
    if (Array.isArray(item.photos) && item.photos.length) {
      return item.photos.filter(Boolean);
    }
    return item.photo ? [item.photo] : [];
  };

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
      const photos = normalizePhotos(item);
      if (photos.length) {
        photoByRow.set(body.length, photos);
      }
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
export function buildReportDoc(report, options = {}) {
  const { spacing = "normal" } = options;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 14;
  const spacingMap = {
    compact: { rowH: 7, textGap: 5, remarkH: 20, padding: 3 },
    normal: { rowH: 9, textGap: 6, remarkH: 24, padding: 4 },
    wide: { rowH: 11, textGap: 8, remarkH: 28, padding: 6 },
  };
  const spacingConfig = spacingMap[spacing] ?? spacingMap.normal;

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
  y += spacingConfig.textGap;

  y = drawHeaderBox(doc, report, y);
  y = drawMetaRow(doc, report, y, spacingConfig.rowH);
  y = drawEngineerRow(doc, report, y, spacingConfig.rowH);

  const { body: checklistBody, photoByRow } = buildChecklistBody(report);
  const THUMB = 16;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["No", "Checklist", "Yes/ No", "Remark"]],
    body: checklistBody,
    theme: "striped",
    styles: {
      fontSize: 9,
      cellPadding: spacingConfig.padding,
      lineColor: [200, 200, 200],
      lineWidth: 0.12,
      font: "helvetica",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [245, 247, 250],
      textColor: [20, 20, 20],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      cellPadding: 5,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [35, 35, 35],
    },
    alternateRowStyles: {
      fillColor: [248, 249, 251],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 24, halign: "center" },
      3: { cellWidth: 52, valign: "top" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3 && photoByRow.has(data.row.index)) {
        const photos = photoByRow.get(data.row.index) || [];
        const extraHeight = photos.length * (THUMB + 2);
        data.cell.styles.minCellHeight = Math.max(
          data.cell.styles.minCellHeight || 0,
          THUMB + 6 + extraHeight,
        );
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 3) return;
      const photos = photoByRow.get(data.row.index);
      if (!photos?.length) return;
      let photoY = data.cell.y + data.cell.height - THUMB - 1;
      photos.slice(0, 3).forEach((photo) => {
        try {
          doc.addImage(
            photo,
            imageFormatFromDataUrl(photo),
            data.cell.x + 1,
            photoY,
            THUMB,
            THUMB,
            undefined,
            "FAST",
          );
          photoY -= THUMB + 2;
        } catch {
          // ignore malformed image data
        }
      });
    },
  });

  y = doc.lastAutoTable.finalY + 4;

  const remarkH = spacingConfig.remarkH;
  doc.setDrawColor(200);
  doc.setLineWidth(0.12);
  doc.rect(MARGIN, y, CONTENT_W, remarkH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Additional Remark:", MARGIN + 2, y + 6);
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
export function getReportPDFBlobUrl(report, options = {}) {
  return buildReportDoc(report, options).output("bloburl");
}

export function generateServiceReportPDF(report, options = {}) {
  const doc = buildReportDoc(report, options);
  doc.save(`${report.reportId ?? "service-report"}.pdf`);
}
