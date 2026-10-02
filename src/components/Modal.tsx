import React from 'react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

export interface ModalProps {
  id?: string;
  open?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  label?: string;
  className?: string;
  children: React.ReactNode;
}

export default function Modal({ id, open, isOpen, onClose, label, className = '', children }: ModalProps) {
  const isVisible = open !== undefined ? open : Boolean(isOpen);

  const dialogRef = useDialogAccessibility<HTMLDivElement>(isVisible, onClose);


  if (!isVisible) return null;

  const isNavModal = className.includes('cx-nav-modal');

  return (
    <div
      className={`fixed inset-0 z-50 flex ${isNavModal ? 'items-stretch justify-start p-0' : 'items-center justify-center p-3 sm:p-4'} bg-[var(--cx-overlay-backdrop)] backdrop-blur-2xs transition-opacity duration-150`}
      role="presentation"
    >
      <div className="fixed inset-0" onMouseDown={event => { event.preventDefault(); onClose?.(); }} aria-hidden="true" />
      <div
        id={id}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label || 'Dialog'}
        className={`relative bg-surface text-text-main ${isNavModal ? 'rounded-none shadow-[var(--cx-shadow-drawer)] h-full max-h-[100dvh] w-[260px] max-w-[85vw]' : 'rounded-[var(--cx-radius-card)] shadow-[var(--cx-shadow-elevated)] max-w-2xl max-h-[90dvh] border border-border'} overflow-hidden z-10 w-full flex flex-col ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
