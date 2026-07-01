import { useTranslation } from 'react-i18next';

export function ShellHome() {
  const { t } = useTranslation();

  return (
    <section className="page-section" aria-labelledby="home-title">
      <h1 id="home-title">{t('shell.home')}</h1>
      <p>{t('pages.placeholder')}</p>
    </section>
  );
}
