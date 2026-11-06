import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportElementAsPDF(
  elementId,
  filename = "report.pdf",
  title = "QU Academic Simulation Report",
) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
  });
  const imageData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.setFontSize(16);
  pdf.text(title, 40, 40);
  pdf.setFontSize(9);
  pdf.text(new Date().toLocaleString(), 40, 58);

  const imageWidth = pageWidth - 80;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;
  let remainingHeight = imageHeight;
  let position = 75;

  pdf.addImage(imageData, "PNG", 40, position, imageWidth, imageHeight);
  remainingHeight -= pageHeight - position;

  while (remainingHeight > 0) {
    pdf.addPage();
    position = remainingHeight - imageHeight;
    pdf.addImage(imageData, "PNG", 40, position, imageWidth, imageHeight);
    remainingHeight -= pageHeight;
  }

  pdf.save(filename);
}
