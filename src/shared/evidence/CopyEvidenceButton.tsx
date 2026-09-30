import React, { useState } from 'react';
import { Copy } from 'lucide-react';

export default function CopyEvidenceButton({ value, label }: { value: string; label: string }) {
  const [feedback, setFeedback] = useState('');
  return <span className="cx-audit-copy">
    <button type="button" className="cx-button-secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(value); setFeedback('Copied'); }
      catch { setFeedback('Copy unavailable. Select and copy the displayed value.'); }
    }}><Copy size={13} aria-hidden="true" />{label}</button>
    <span role="status" aria-live="polite">{feedback}</span>
  </span>;
}
