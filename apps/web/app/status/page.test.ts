import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusPage from './page';

describe('status page', () => {
  it('renders the web health status', () => {
    render(StatusPage());
    expect(
      screen.getByRole('heading', { name: 'NovaVend preview is available' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Development preview — frontend only'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'This static page does not indicate API, database, authentication, or commerce availability.',
      ),
    ).toBeTruthy();
  });
});
