import { useTranslation } from 'react-i18next';

export function ShellPlaceholder({ titleKey }: { readonly titleKey: string }) {
  const { t } = useTranslation();

  return (
    <section className="page-section" aria-labelledby="placeholder-title">
      <h1 id="placeholder-title">{t(titleKey)}</h1>
      <p>{t('pages.placeholder')}</p>
    </section>
  );
}
