import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

type ConfirmOptions = {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
};

type PendingConfirm = ConfirmOptions & {
  readonly resolve: (confirmed: boolean) => void;
};

type ConfirmContextValue = {
  confirm(options: ConfirmOptions): Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback(
    (confirmed: boolean) => {
      pending?.resolve(confirmed);
      setPending(null);
    },
    [pending],
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  useEffect(() => {
    if (!pending) {
      return;
    }

    cancelButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, pending]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <div className="modal-backdrop">
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title">{pending.title}</h2>
            <p>{pending.message}</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="button secondary"
                ref={cancelButtonRef}
                onClick={() => close(false)}
              >
                {t('confirm.cancel')}
              </button>
              <button type="button" className="button danger" onClick={() => close(true)}>
                {pending.confirmLabel ?? t('confirm.confirm')}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const value = useContext(ConfirmContext);
  if (!value) {
    throw new Error('ConfirmProvider is missing.');
  }

  return value;
}
