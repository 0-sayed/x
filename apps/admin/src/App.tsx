const fallbackApiBaseUrl = 'http://127.0.0.1:3000';

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function App() {
  const rawApiBaseUrl =
    typeof import.meta.env.VITE_API_BASE_URL === 'string'
      ? import.meta.env.VITE_API_BASE_URL
      : fallbackApiBaseUrl;
  const apiBaseUrl = trimTrailingSlash(rawApiBaseUrl);
  const healthUrl = `${apiBaseUrl}/health`;
  const bootstrapUrl = `${apiBaseUrl}/bootstrap`;
  const docsUrl = `${apiBaseUrl}/docs`;
  const openApiUrl = `${apiBaseUrl}/docs-json`;

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="admin-shell-title">
        <p className="eyebrow">Bootstrap shell</p>
        <h1 id="admin-shell-title">Materiabill Admin</h1>
        <p className="lede">
          Operational shell only. This workspace exposes runtime metadata and smoke endpoints while
          product flows stay out of scope.
        </p>
      </section>

      <section className="panel-grid" aria-label="Bootstrap overview">
        <article className="panel">
          <h2>Runtime</h2>
          <dl className="status-list">
            <div>
              <dt>UI mode</dt>
              <dd>Vite + React shell</dd>
            </div>
            <div>
              <dt>API base URL</dt>
              <dd>
                <code>{apiBaseUrl}</code>
              </dd>
            </div>
            <div>
              <dt>Expected checks</dt>
              <dd>Health, bootstrap metadata, Swagger JSON</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <h2>Smoke endpoints</h2>
          <ul className="link-list">
            <li>
              <a href={healthUrl}>Health</a>
            </li>
            <li>
              <a href={bootstrapUrl}>Bootstrap metadata</a>
            </li>
            <li>
              <a href={docsUrl}>Swagger UI</a>
            </li>
            <li>
              <a href={openApiUrl}>OpenAPI JSON</a>
            </li>
          </ul>
        </article>

        <article className="panel">
          <h2>Bootstrap scope</h2>
          <ul className="scope-list">
            <li>Admin shell layout and smoke links</li>
            <li>Local PostgreSQL and RabbitMQ wiring</li>
            <li>Developer setup, validation, and worktree docs</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
