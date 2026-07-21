import { useState, useEffect, type ReactNode } from 'react';
import { X, Loader2 } from 'lucide-react';

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className={`my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl border border-white/10 bg-ink-850 shadow-card`}>
        <header className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-steel-300/70 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const doConfirm = async () => {
    setBusy(true);
    try { await onConfirm(); onClose(); } finally { setBusy(false); }
  };
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className="btn-ghost">Cancel</button>
          <button onClick={doConfirm} disabled={busy} className={danger ? 'btn-danger' : 'btn-primary'}>
            {busy && <Loader2 size={14} className="animate-spin" />} {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-steel-200">{message}</p>
    </Modal>
  );
}
