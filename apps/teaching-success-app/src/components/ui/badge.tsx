import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-[0.04em]",
  {
    variants: {
      variant: {
        neutral: "bg-brand-ink/8 text-brand-ink",
        blue: "bg-brand-blue/15 text-brand-blue",
        green: "bg-brand-green/15 text-brand-green",
        amber: "bg-brand-amber/15 text-brand-amber",
        red: "bg-brand-red/15 text-brand-red",
        gold: "bg-brand-gold/20 text-brand-ink"
      }
    },
    defaultVariants: {
      variant: "neutral"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
