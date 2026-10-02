import React from 'react';

/** One metric composition; preserves each child's evidence and inspection behaviour. */
export default function TelemetryRail({ children, label = 'Key measures', className = '' }: {
  children: React.ReactNode; label?: string; className?: string;
}) {
  return <section className={`cx-telemetry-rail ${className}`} aria-label={label}>{children}</section>;
}
