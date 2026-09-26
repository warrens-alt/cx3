import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const backgroundLocks = new Map<HTMLElement, { count: number; wasInert: boolean }>();
let scrollLocks = 0;
let restoreScroll: (() => void) | undefined;

function isVisible(element: HTMLElement) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible'
    && !element.closest('[hidden], [inert], [aria-hidden="true"]');
}

export function useDialogAccessibility<T extends HTMLElement>(open: boolean, onClose?: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && isVisible(element));
    const isTopmost = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'));
      const topmostDialog = dialogs.at(-1);
      return topmostDialog === dialog;
    };

    // Each dialog owns its locks, so closing a nested dialog keeps the outer one modal.
    const locked: HTMLElement[] = [];
    let ancestor: HTMLElement = dialog;
    while (ancestor.parentElement && ancestor !== document.body) {
      for (const sibling of ancestor.parentElement.children) {
        if (!(sibling instanceof HTMLElement) || sibling === ancestor || ['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) continue;
        // Decorative backdrops still need their outside-click dismiss handler.
        if (sibling.getAttribute('aria-hidden') === 'true' && !sibling.matches(FOCUSABLE) && !sibling.querySelector(FOCUSABLE)) continue;
        const lock = backgroundLocks.get(sibling) || { count: 0, wasInert: sibling.inert };
        lock.count += 1;
        backgroundLocks.set(sibling, lock);
        sibling.inert = true;
        locked.push(sibling);
      }
      ancestor = ancestor.parentElement;
    }
    if (scrollLocks++ === 0) {
      const bodyOverflow = document.body.style.overflow;
      const main = document.querySelector<HTMLElement>('.cx-main');
      const mainOverflow = main?.style.overflow || '';
      document.body.style.overflow = 'hidden';
      if (main) main.style.overflow = 'hidden';
      restoreScroll = () => {
        document.body.style.overflow = bodyOverflow;
        if (main) main.style.overflow = mainOverflow;
      };
    }
    const focusFirst = () => {
      if (!isTopmost() || dialog.contains(document.activeElement)) return;
      const initial = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]');
      (initial && isVisible(initial) ? initial : focusable()[0] || dialog).focus({ preventScroll: true });
    };
    const frame = window.requestAnimationFrame(focusFirst);
    const handleFocus = (event: FocusEvent) => {
      if (isTopmost() && !dialog.contains(event.target as Node)) focusFirst();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (event.key === 'Escape' && closeRef.current) {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0], last = elements.at(-1);
      const active = document.activeElement;
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (active === first || !elements.includes(active as HTMLElement))) {
        event.preventDefault();
        last!.focus();
      } else if (!event.shiftKey && (active === last || !elements.includes(active as HTMLElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocus);
      for (const element of locked) {
        const lock = backgroundLocks.get(element)!;
        if (--lock.count === 0) {
          element.inert = lock.wasInert;
          backgroundLocks.delete(element);
        }
      }
      if (--scrollLocks === 0) { restoreScroll?.(); restoreScroll = undefined; }
      if (previousFocus?.isConnected && isVisible(previousFocus)) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  return ref;
}
