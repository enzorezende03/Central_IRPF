import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  subtitle?: string;
  onClick?: () => void;
  active?: boolean;
  compact?: boolean;
}

export function StatCard({ label, value, icon: Icon, color = "text-primary", subtitle, onClick, active, compact }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-xl border bg-card shadow-sm hover:shadow-md transition-all",
        compact ? "p-2 sm:p-3" : "p-3 sm:p-5",
        onClick && "cursor-pointer",
        active && "ring-2 ring-primary border-primary"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
          <p className={cn(compact ? "text-base sm:text-xl font-bold" : "text-lg sm:text-2xl font-bold", color)}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn(
          "rounded-lg flex items-center justify-center bg-muted shrink-0",
          compact ? "h-6 w-6 sm:h-8 sm:w-8" : "h-8 w-8 sm:h-10 sm:w-10",
          color
        )}>
          <Icon className={cn(compact ? "h-3 w-3 sm:h-4 sm:w-4" : "h-4 w-4 sm:h-5 sm:w-5")} />
        </div>
      </div>
    </motion.div>
  );
}
