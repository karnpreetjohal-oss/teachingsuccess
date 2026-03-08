import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
};

export function PageIntro({ eyebrow, title, description, actions, className }: PageIntroProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[32px] border border-brand-line bg-[linear-gradient(135deg,rgba(44,58,82,0.96),rgba(58,95,149,0.9))] px-5 py-6 text-white shadow-soft md:px-7 md:py-8",
        className
      )}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-brand-goldSoft">{eyebrow}</p>
          <h1 className="font-display text-4xl font-black leading-tight md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 md:text-base">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
