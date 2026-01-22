const PDFDocument = require("pdfkit");

function createCertificatePdf({ name, courseTitle, issuedAt }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  doc.fontSize(22).text("Certificate of Completion", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(12).text("This certifies that", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(20).text(name, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).text("has successfully completed", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(16).text(courseTitle, { align: "center" });
  doc.moveDown(1.5);
  doc.fontSize(10).text(`Issued: ${issuedAt}`, { align: "center" });

  doc.moveDown(3);
  doc.fontSize(10).text("Eritrean Success Journey • Learn • Grow • Believe • Succeed", { align: "center" });

  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

module.exports = { createCertificatePdf };
