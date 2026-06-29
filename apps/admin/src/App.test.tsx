// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App.js';

describe('App', () => {
  it('renders the bootstrap shell with smoke links', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Materiabill Admin' })).toBeVisible();
    expect(screen.getByText('Vite + React shell')).toBeVisible();
    expect(screen.getByText('http://127.0.0.1:3000')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Health' })).toHaveAttribute(
      'href',
      'http://127.0.0.1:3000/health',
    );
    expect(screen.getByRole('link', { name: 'OpenAPI JSON' })).toHaveAttribute(
      'href',
      'http://127.0.0.1:3000/docs-json',
    );
  });
});
