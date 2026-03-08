import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink shadow-sm outline-none transition placeholder:text-brand-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";

export { Input };
