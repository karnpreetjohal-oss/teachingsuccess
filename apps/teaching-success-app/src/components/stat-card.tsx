import { TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatTone = "blue" | "green" | "amber" | "red";

const toneMap: Record<StatTone, string> = {
  blue: "from-brand-blue/15 to-transparent text-brand-blue",
  green: "from-brand-green/15 to-transparent text-brand-green",
  amber: "from-brand-amber/15 to-transparent text-brand-amber",
  red: "from-brand-red/15 to-transparent text-brand-red"
};

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  tone?: StatTone;
};

export function StatCard({ label, value, helper, tone = "blue" }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className={cn("h-1 w-full bg-gradient-to-r", toneMap[tone])} />
        <div className="p-5 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand-muted">{label}</p>
              <p className="mt-2 font-display text-4xl font-black text-brand-ink">{value}</p>
            </div>
            <div className="rounded-2xl bg-brand-surface p-2 text-brand-muted">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="text-sm leading-6 text-brand-muted">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}
