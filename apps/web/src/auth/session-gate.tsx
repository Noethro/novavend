'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocale } from '../i18n/locale-provider';
import {
  getCurrentSession,
  logoutSession,
  previewMode,
  UnauthenticatedError,
} from './auth-client';

export function SessionGate({
  children,
  onboarding = false,
  fetcher = fetch,
  isPreview = previewMode,
}: {
  children: ReactNode;
  onboarding?: boolean;
  fetcher?: typeof fetch;
  isPreview?: boolean;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [ready, setReady] = useState(isPreview);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (isPreview) return;
    let active = true;
    void getCurrentSession(fetcher, isPreview)
      .then((session) => {
        if (!active) return;
        if (session.needsOnboarding && !onboarding) {
          router.replace('/onboarding');
        } else if (!session.needsOnboarding && onboarding) {
          router.replace('/');
        } else {
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        if (active && error instanceof UnauthenticatedError)
          router.replace('/login');
      });
    return () => {
      active = false;
    };
  }, [fetcher, isPreview, onboarding, router]);

  const logout = async () => {
    if (isPreview || loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutSession(fetcher, isPreview);
      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  if (!ready)
    return (
      <div className="session-loading" role="status">
        {t('auth.sessionLoading')}
      </div>
    );

  return (
    <>
      {!onboarding && !isPreview ? (
        <button
          className="logout-button"
          disabled={loggingOut}
          onClick={logout}
          type="button"
        >
          {loggingOut ? t('auth.loading') : t('auth.logout')}
        </button>
      ) : null}
      {children}
    </>
  );
}
