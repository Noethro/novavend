import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders its label and forwards button properties', () => {
    render(<Button disabled>Save</Button>);
    const button = screen.getByRole('button', {
      name: 'Save',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
