import React, { useEffect, useId } from 'react';

/** Local presentation only. Panels stay mounted so query and editor lifetimes do not change. */
export default function ReportSections({ label, sections, value, onChange }: {
  label: string;
  sections: { id: string; label: string; content: React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  useEffect(() => {
    const active = document.activeElement;
    if (active?.closest('[role="tabpanel"][hidden]')) document.getElementById(`${id}-tab-${value}`)?.focus();
  }, [id, value]);
  return <div className="cx-report-sections">
    <div role="tablist" aria-label={label} className="cx-report-section-tabs">
      {sections.map((section, index) => <button key={section.id} type="button" role="tab"
        id={`${id}-tab-${section.id}`} aria-controls={`${id}-panel-${section.id}`}
        aria-selected={value === section.id} tabIndex={value === section.id ? 0 : -1}
        onClick={() => onChange(section.id)} onKeyDown={event => {
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1
            : event.key === 'ArrowRight' ? (index + 1) % sections.length
            : event.key === 'ArrowLeft' ? (index - 1 + sections.length) % sections.length : null;
          if (next === null) return;
          event.preventDefault();
          onChange(sections[next].id);
          document.getElementById(`${id}-tab-${sections[next].id}`)?.focus();
        }}>{section.label}</button>)}
    </div>
    {sections.map(section => <div key={section.id} id={`${id}-panel-${section.id}`}
      role="tabpanel" aria-labelledby={`${id}-tab-${section.id}`} tabIndex={0}
      hidden={value !== section.id} className="cx-report-section">{section.content}</div>)}
  </div>;
}
