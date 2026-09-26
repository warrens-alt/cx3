import { lazy, Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import Modal from './Modal';
import '../styles/guidedAnalytics.css';
const ManagementReview = lazy(() => import('./ManagementReview'));

export default function ReviewLauncher({ afterNavigate }: { afterNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <>
    <button type="button" className="cx-button-secondary cx-review-launch" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><ClipboardList size={15} aria-hidden="true"/>Start a review</button>
    {open && createPortal(<Modal open onClose={close} label="Management review" className="cx-review-modal">
      <ErrorBoundary fallback={<div className="cx-review-body" role="alert"><p>The review could not load.</p><button type="button" onClick={close}>Close review</button></div>}>
        <Suspense fallback={<div className="cx-review-body"><p role="status">Opening management review…</p><button type="button" className="cx-button-secondary" onClick={close}>Cancel</button></div>}>
          <ManagementReview onClose={close} onNavigate={() => { close(); afterNavigate?.(); }}/>
        </Suspense>
      </ErrorBoundary>
    </Modal>, document.body)}
  </>;
}
