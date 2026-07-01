import { LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/hooks.js';

export function LoginScreen() {
  const { t } = useTranslation();
  const client = useApiClient();

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <p className="eyebrow">{t('auth.eyebrow')}</p>
        <h1 id="login-title">{t('auth.title')}</h1>
        <p>{t('auth.body')}</p>
        <button
          type="button"
          className="button primary"
          onClick={() => {
            window.location.href = client.loginUrl();
          }}
        >
          <LogIn aria-hidden="true" size={18} />
          {t('auth.cta')}
        </button>
      </section>
    </main>
  );
}
