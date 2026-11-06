import { useState } from "react";
import { HelpCircle } from "lucide-react";

export default function TooltipHelp({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <HelpCircle size={13} className="text-qu-text-muted cursor-help" />
      {open && (
        <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-56 p-2 rounded-md bg-qu-text text-white text-[11px] leading-snug shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}
