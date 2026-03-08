import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonStyles = cva(
  "inline-flex items-center justify-center rounded-2xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 ring-offset-white",
  {
    variants: {
      variant: {
        default: "bg-brand-gold text-brand-ink shadow-soft hover:bg-brand-goldSoft",
        secondary: "bg-brand-ink text-white shadow-soft hover:bg-brand-inkDeep",
        outline: "border border-brand-line bg-white/80 text-brand-ink hover:border-brand-gold hover:bg-brand-gold/10",
        ghost: "bg-transparent text-brand-ink hover:bg-white/70"
      },
      size: {
        default: "h-12 px-5 text-sm",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 px-6 text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {}

export function buttonVariants(
  options?: VariantProps<typeof buttonStyles> & {
    className?: string;
  }
) {
  const { className, ...variants } = options ?? {};
  return cn(buttonStyles(variants), className);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={buttonVariants({ variant, size, className })} {...props} />
  )
);

Button.displayName = "Button";

export { Button };
