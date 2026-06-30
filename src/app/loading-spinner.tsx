"use client";

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Cargando"
    />
  );
}

export function LoadingCard({ label = "Cargando..." }: { label?: string }) {
  return (
    <section className="practice-card-large loading-card" aria-live="polite" aria-busy="true">
      <Spinner size={22} />
      <span>{label}</span>
    </section>
  );
}
