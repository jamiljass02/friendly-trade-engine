import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "profit" | "loss" | "neutral";
  icon: LucideIcon;
  subtitle?: string;
}

const MetricCard = ({ title, value, change, changeType = "neutral", icon: Icon, subtitle }: MetricCardProps) => {
  return (
    <div className="glass-card rounded-xl p-5 animate-slide-up">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="metric-value text-foreground">{value}</p>
          {change && (
            <p className={cn("text-xs font-mono font-medium", {
              "text-profit": changeType === "profit",
              "text-loss": changeType === "loss",
              "text-muted-foreground": changeType === "neutral",
            })}>
              {change}
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", {
          "bg-primary/10": changeType === "neutral",
          "bg-success/10": changeType === "profit",
          "bg-destructive/10": changeType === "loss",
        })}>
          <Icon className={cn("w-5 h-5", {
            "text-primary": changeType === "neutral",
            "text-profit": changeType === "profit",
            "text-loss": changeType === "loss",
          })} />
        </div>
      </div>
    </div>
  );
};

export default MetricCard;
