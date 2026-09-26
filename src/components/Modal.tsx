import React from 'react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

export interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  label?: string;
  className?: string;
  children: React.ReactNode;
}

export default function Modal({ open, isOpen, onClose, label, className = '', children }: ModalProps) {
  const isVisible = open !== undefined ? open : Boolean(isOpen);

  const dialogRef = useDialogAccessibility<HTMLDivElement>(isVisible, onClose);


  if (!isVisible) return null;

  const isNavModal = className.includes('cx-nav-modal');

  return (
    <div
      className={`fixed inset-0 z-50 flex ${isNavModal ? 'items-stretch justify-start p-0' : 'items-center justify-center p-3 sm:p-4'} bg-black/50 backdrop-blur-2xs transition-opacity duration-200`}
      role="dialog"
      aria-modal="true"
      aria-label={label || 'Dialog'}
    >
      <div className="fixed inset-0" onMouseDown={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative bg-white ${isNavModal ? 'rounded-none shadow-2xl h-full max-h-[100dvh] w-[260px] max-w-[85vw]' : 'rounded-lg sm:rounded-xl shadow-xl max-w-2xl max-h-[90dvh]'} overflow-hidden z-10 w-full flex flex-col ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
