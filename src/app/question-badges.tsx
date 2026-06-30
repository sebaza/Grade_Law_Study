"use client";

import { Info } from "lucide-react";

export function probabilityLevel(probability: number): { label: string; tone: "high" | "mid" | "low" } {
  if (probability >= 66) return { label: "Alta", tone: "high" };
  if (probability >= 33) return { label: "Media", tone: "mid" };
  return { label: "Baja", tone: "low" };
}

// Highlighted, plain-language indicator of how likely the question is to appear
// in the real exam. Replaces the cryptic "72% prob." chip.
export function ProbabilityBadge({ probability }: { probability: number }) {
  const rounded = Math.round(probability);
  const { label, tone } = probabilityLevel(probability);
  return (
    <span className={`prob-badge prob-${tone}`} title={`Probabilidad estimada de que esta pregunta salga en el examen: ${rounded}%`}>
      <span className="prob-badge-label">Sale en examen</span>
      <strong>{label}</strong>
      <small>{rounded}%</small>
    </span>
  );
}

// Small info affordance: an "i" icon with a tooltip explaining the secondary
// numbers a student may not recognize, so they don't clutter the card.
export function InfoHint({ text }: { text: string }) {
  return (
    <span className="info-hint" tabIndex={0} role="note" aria-label={text} data-tip={text}>
      <Info size={15} strokeWidth={2} />
    </span>
  );
}
