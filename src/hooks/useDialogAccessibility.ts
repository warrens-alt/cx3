import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogAccessibility<T extends HTMLElement>(
  open: boolean,
  onClose?: () => void,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;

    const dialog = ref.current;
    if (!dialog) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    const appMain = document.querySelector<HTMLElement>('.cx-main');
    const previousMainOverflow = appMain?.style.overflow || '';
    document.body.style.overflow = 'hidden';
    if (appMain) appMain.style.overflow = 'hidden';

    const focusFirst = () => {
      if (dialog.contains(document.activeElement)) return;
      const target = dialog.querySelector<HTMLElement>('[autofocus], [data-dialog-initial-focus], ' + FOCUSABLE);
      (target || dialog).focus({ preventScroll: true });
    };
    const frame = window.requestAnimationFrame(focusFirst);

    const handleKeyDown = (event: KeyboardEvent) => {
      const openDialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'));
      const topmostDialog = openDialogs[openDialogs.length - 1];
      if (topmostDialog && topmostDialog !== dialog) return;

      if (event.key === 'Escape' && onClose) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');

      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (appMain) appMain.style.overflow = previousMainOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  return ref;
}
