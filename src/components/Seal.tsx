"use client";

import { Flame } from "lucide-react";

// Printed round quality stamp with a thin white outline. The ring text is
// stretched to fit the circle exactly once (textLength + lengthAdjust) so the
// letters never overlap, and the centre shows a white flame icon matching the
// rest of the UI iconography.
export function Seal({
  className = "",
}: {
  className?: string;
  // Accepted for backwards compatibility with callers; no longer rendered.
  logo?: string;
  label?: string;
}) {
  const text = "RUČNÁ VÝROBA · ČERSTVÉ SUROVINY · VYSOKÁ TEPLOTA · ";
  // Circumference of the r=38 ring in the 100×100 viewBox (2·π·38 ≈ 238.76).
  const ringLength = 238.76;
  return (
    <div className={className}>
      <div className="relative flex h-[132px] w-[132px] items-center justify-center rounded-full border border-white/25 bg-black/25 backdrop-blur-md">
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
          <text className="fill-white/80 text-[6.4px] font-semibold uppercase tracking-[0.14em]">
            <textPath
              href="#seal-path"
              startOffset="0"
              textLength={ringLength}
              lengthAdjust="spacing"
            >
              {text}
            </textPath>
          </text>
        </svg>

        <span className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full border border-white/15 bg-black/30 shadow-inner">
          <Flame className="h-8 w-8 text-white" strokeWidth={1.5} aria-hidden />
        </span>
      </div>
    </div>
  );
}
