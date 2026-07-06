"use client";

// Rotating circular stamp: "RUČNÁ PRÍPRAVA · KVALITNÉ SUROVINY ·"
export function Seal({ className = "" }: { className?: string }) {
  const text = "RUČNÁ PRÍPRAVA · KVALITNÉ SUROVINY · ";
  return (
    <div className={className}>
      <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/25 bg-black/40 backdrop-blur-md sm:h-32 sm:w-32">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full animate-spinslow"
        >
          <defs>
            <path
              id="seal-circle"
              d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
            />
          </defs>
          <text className="fill-white/85 text-[8.4px] font-semibold uppercase tracking-[0.14em]">
            <textPath href="#seal-circle" startOffset="0">
              {text}
            </textPath>
          </text>
        </svg>
        <span className="text-3xl sm:text-4xl">🍅</span>
      </div>
    </div>
  );
}
