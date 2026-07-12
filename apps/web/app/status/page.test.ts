import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusPage from './page';

describe('status page', () => {
  it('renders the web health status', () => {
    render(StatusPage());
    expect(
      screen.getByRole('heading', { name: 'NovaVend web is healthy' }),
    ).toBeTruthy();
    expect(
      screen.getByText('The dashboard process is available.'),
    ).toBeTruthy();
  });
});
