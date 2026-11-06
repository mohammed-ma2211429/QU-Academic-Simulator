import { useState } from "react";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { exportCSV } from "../utils/dataExport";

export default function ExportButton({ csvData, csvFilename = "export.csv", pdfElementId, pdfFilename = "report.pdf", pdfTitle }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-qu-maroon rounded-md px-3 py-2 hover:bg-qu-maroon-mid transition-colors"
      >
        <Download size={14} /> Export
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 w-44 qu-card border border-qu-border py-1 z-20"
          onMouseLeave={() => setOpen(false)}
        >
          {csvData && (
            <button
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-qu-off-white"
              onClick={() => { exportCSV(csvData, csvFilename); setOpen(false); }}
            >
              <FileSpreadsheet size={14} /> Export as CSV
            </button>
          )}
          {pdfElementId && (
            <button
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-qu-off-white"
              onClick={async () => {
                const { exportElementAsPDF } = await import("../utils/pdfExport");
                await exportElementAsPDF(pdfElementId, pdfFilename, pdfTitle);
                setOpen(false);
              }}
            >
              <FileText size={14} /> Export as PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}
