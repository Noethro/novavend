import type { ButtonHTMLAttributes } from 'react';

export function Button({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-fit rounded-full border border-emerald-800 bg-emerald-950 px-4 py-3 text-emerald-200 disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    />
  );
}
