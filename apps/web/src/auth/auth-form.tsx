'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useLocale } from '../i18n/locale-provider';
import { authDestination, postAuth, previewMode } from './auth-client';

type Mode = 'login' | 'register' | 'onboarding';

export function AuthForm({ mode }: { mode: Mode }) {
  const { t } = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const titleKey = `auth.${mode}Title` as const;
  const subtitleKey = `auth.${mode}Subtitle` as const;
  const submitKey = `auth.${mode}Submit` as const;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (previewMode || loading) return;
    setLoading(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      [...data.entries()].map(([key, value]) => [key, String(value)]),
    );
    try {
      if (mode === 'onboarding') {
        await postAuth('/onboarding/workspace', body);
        router.push('/');
      } else {
        const session = await postAuth<{ needsOnboarding: boolean }>(
          `/auth/${mode === 'register' ? 'register' : 'login'}`,
          body,
        );
        router.push(authDestination(session));
      }
    } catch {
      setError(t('auth.requestFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-card" data-auth-screen={mode}>
      <p className="eyebrow">{t('previewBadge')}</p>
      <h1>{t(titleKey)}</h1>
      <p className="auth-subtitle">{t(subtitleKey)}</p>
      {previewMode ? (
        <p className="preview-explanation">{t('auth.previewNotice')}</p>
      ) : null}
      <form
        onSubmit={submit}
        aria-describedby={error ? 'auth-error' : undefined}
      >
        {mode === 'register' ? (
          <AuthField
            label={t('auth.displayName')}
            name="displayName"
            minLength={2}
          />
        ) : null}
        {mode !== 'onboarding' ? (
          <>
            <AuthField label={t('auth.email')} name="email" type="email" />
            <AuthField
              label={t('auth.password')}
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
            />
          </>
        ) : (
          <>
            <AuthField
              label={t('auth.workspaceName')}
              name="name"
              minLength={2}
            />
            <AuthField
              label={t('auth.slugOptional')}
              name="slug"
              required={false}
            />
          </>
        )}
        {error ? (
          <p className="form-error" id="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={previewMode || loading}>
          {loading ? t('auth.loading') : t(submitKey)}
        </button>
        {previewMode ? <small>{t('auth.unavailable')}</small> : null}
      </form>
      {mode === 'login' ? (
        <Link href="/register">{t('auth.loginRegister')}</Link>
      ) : null}
      {mode === 'register' ? (
        <Link href="/login">{t('auth.registerLogin')}</Link>
      ) : null}
    </section>
  );
}

function AuthField({
  label,
  name,
  required = true,
  type = 'text',
  ...constraints
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input name={name} type={type} required={required} {...constraints} />
    </label>
  );
}
