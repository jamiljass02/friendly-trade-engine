import { cn } from "@/lib/utils";
import { type ExpiryDate } from "@/lib/expiry-utils";

interface ExpirySelectorProps {
  expiries: ExpiryDate[];
  selected: string; // label like "27 Feb"
  onSelect: (label: string) => void;
}

const ExpirySelector = ({ expiries, selected, onSelect }: ExpirySelectorProps) => {
  // Show first 6 expiries, group by current/next/far + rest
  const displayExpiries = expiries.slice(0, 8);

  return (
    <div className="flex gap-1 flex-wrap items-center">
      {displayExpiries.map((exp) => (
        <button
          key={exp.label}
          onClick={() => onSelect(exp.label)}
          className={cn(
            "px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors relative",
            selected === exp.label
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          {exp.label}
          {exp.isMonthly && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent" />
          )}
        </button>
      ))}
    </div>
  );
};

export default ExpirySelector;
