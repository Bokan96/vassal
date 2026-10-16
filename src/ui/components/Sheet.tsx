import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n.ts';

/** A modal sheet (used on phones for the combinations and the game log). */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog sheet" onClose={onClose} aria-label={title}>
      <header className="dialog__header">
        <h2>{title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t.close}>
          ✕
        </button>
      </header>
      <div className="sheet__body">{children}</div>
    </dialog>
  );
}
