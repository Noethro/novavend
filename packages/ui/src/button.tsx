import type { ButtonHTMLAttributes } from 'react';

export function Button({
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        width: 'fit-content',
        border: '1px solid #38775a',
        borderRadius: '999px',
        padding: '0.75rem 1rem',
        background: '#10291f',
        color: '#a8d9c1',
        font: 'inherit',
        ...style,
      }}
    />
  );
}
