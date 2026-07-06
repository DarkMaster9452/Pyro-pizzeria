"use client";

import { Flame } from "lucide-react";

// Printed round quality stamp with a thin white outline.
export function Seal({ className = "" }: { className?: string }) {
  const text = "RUČNÁ VÝROBA · ČERSTVÉ SUROVINY · PEC NA DREVE · ";
  return (
    <div className={className}>
      <div className="relative flex h-[132px] w-[132px] items-center justify-center rounded-full border border-white/25 bg-black/25 backdrop-blur-md">
        <div className="absolute inset-[7px] rounded-full border border-white/15" />
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full animate-spinslow"
          aria-hidden
        >
          <defs>
            <path
              id="seal-path"
              d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"
            />
          </defs>
          <text className="fill-white/80 text-[7.1px] font-semibold uppercase tracking-[0.22em]">
            <textPath href="#seal-path" startOffset="0">
              {text}
            </textPath>
          </text>
        </svg>
        <Flame className="h-7 w-7 text-white" strokeWidth={1.5} />
      </div>
    </div>
  );
}
