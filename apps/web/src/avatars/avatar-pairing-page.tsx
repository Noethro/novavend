'use client';

import { useEffect, useRef, useState } from 'react';
import { getCurrentSession, previewMode } from '../auth/auth-client';
import { useLocale } from '../i18n/locale-provider';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Avatar = {
  id: string;
  avatarUuid: string;
  displayName: string | null;
  linkedAt: string;
};
type Challenge = {
  challengeId: string;
  expiresAt: string;
  pairingToken?: string;
  status: string;
  avatar?: Avatar;
};

export const pairingSecondsRemaining = (expiresAt: string, now = Date.now()) =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));

export const shouldPollPairing = (
  status: string,
  failures: number,
  expiresAt: string,
  now = Date.now(),
) =>
  status === 'pending' &&
  failures < 3 &&
  pairingSecondsRemaining(expiresAt, now) > 0;

export const copyPairingToken = async (
  pairingToken: string,
  clipboard:
    Pick<Clipboard, 'writeText'> | null | undefined = navigator.clipboard,
  documentTarget: Document = document,
): Promise<boolean> => {
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(pairingToken);
      return true;
    } catch {
      return false;
    }
  }

  const textarea = documentTarget.createElement('textarea');
  const activeElement = documentTarget.activeElement as HTMLElement | null;
  textarea.value = pairingToken;
  textarea.setAttribute('aria-hidden', 'true');
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  documentTarget.body.append(textarea);
  textarea.select();
  try {
    return documentTarget.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    activeElement?.focus();
  }
};

export function AvatarPairingPage({
  fetcher = fetch,
  isPreview = previewMode,
  copyText = copyPairingToken,
}: {
  fetcher?: typeof fetch;
  isPreview?: boolean;
  copyText?: (value: string) => Promise<boolean>;
}) {
  const { t } = useLocale();
  const [workspace, setWorkspace] = useState<{
    id: string;
    name: string;
    role: string;
  }>();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [challenge, setChallenge] = useState<Challenge>();
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<
    'success' | 'failure' | undefined
  >();
  const failures = useRef(0);

  const request = async (path: string, init?: RequestInit) => {
    if (isPreview) throw new Error('PREVIEW_MODE');
    const response = await fetcher(`${apiUrl}${path}`, {
      credentials: 'include',
      ...init,
    });
    if (!response.ok) throw new Error('PAIRING_REQUEST_FAILED');
    return response;
  };

  const loadAvatars = async (workspaceId: string) => {
    const response = await request(`/workspaces/${workspaceId}/avatars`);
    setAvatars(((await response.json()) as { avatars: Avatar[] }).avatars);
  };

  useEffect(() => {
    if (isPreview) return;
    let active = true;
    void getCurrentSession(fetcher, false)
      .then(async (session) => {
        const first = session.workspaces[0];
        if (!active || !first) return;
        setWorkspace(first);
        await loadAvatars(first.id);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [fetcher, isPreview]);

  useEffect(() => {
    if (!challenge || challenge.status !== 'pending') return;
    const tick = () =>
      setRemaining(pairingSecondsRemaining(challenge.expiresAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  useEffect(() => {
    if (
      isPreview ||
      !workspace ||
      !challenge ||
      !shouldPollPairing(
        challenge.status,
        failures.current,
        challenge.expiresAt,
      )
    )
      return;
    const poll = window.setInterval(() => {
      void request(
        `/workspaces/${workspace.id}/avatar-pairings/${challenge.challengeId}`,
      )
        .then((response) => response.json() as Promise<Challenge>)
        .then((next) => {
          failures.current = 0;
          setChallenge((current) => ({
            ...next,
            pairingToken: current?.pairingToken,
          }));
          if (next.status === 'claimed') void loadAvatars(workspace.id);
        })
        .catch(() => {
          failures.current += 1;
          if (
            !shouldPollPairing(
              challenge.status,
              failures.current,
              challenge.expiresAt,
            )
          )
            window.clearInterval(poll);
        });
    }, 3000);
    return () => window.clearInterval(poll);
  }, [challenge?.challengeId, challenge?.status, isPreview, workspace?.id]);

  const create = async () => {
    if (!workspace || isPreview) return;
    setError(false);
    setCopyFeedback(undefined);
    try {
      const response = await request(
        `/workspaces/${workspace.id}/avatar-pairings`,
        {
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      setChallenge((await response.json()) as Challenge);
    } catch {
      setError(true);
    }
  };

  const cancel = async () => {
    if (!workspace || !challenge || isPreview) return;
    await request(
      `/workspaces/${workspace.id}/avatar-pairings/${challenge.challengeId}`,
      { method: 'DELETE' },
    );
    setChallenge({
      ...challenge,
      pairingToken: undefined,
      status: 'cancelled',
    });
    setCopyFeedback(undefined);
  };

  const copy = async () => {
    if (!challenge?.pairingToken || isPreview) return;
    setCopyFeedback(
      (await copyText(challenge.pairingToken)) ? 'success' : 'failure',
    );
  };

  const revoke = async (avatar: Avatar) => {
    if (!workspace || isPreview || !window.confirm(t('avatars.confirmRevoke')))
      return;
    await request(`/workspaces/${workspace.id}/avatars/${avatar.id}`, {
      method: 'DELETE',
    });
    setAvatars((items) => items.filter((item) => item.id !== avatar.id));
  };

  const canManage =
    isPreview || workspace?.role === 'owner' || workspace?.role === 'manager';

  return (
    <div className="avatars-page" data-avatars-marker="novavend-avatars">
      <p className="eyebrow">{t('previewBadge')}</p>
      <h1>{t('avatars.title')}</h1>
      <p>{t('avatars.subtitle')}</p>
      <p>
        <strong>{t('avatars.workspace')}:</strong>{' '}
        {isPreview ? t('workspacePlaceholder') : (workspace?.name ?? '—')}
      </p>
      {isPreview ? (
        <p className="preview-explanation">{t('avatars.previewNotice')}</p>
      ) : null}
      <section className="avatar-panel">
        <h2>{t('avatars.stepsTitle')}</h2>
        <ol>
          <li>{t('avatars.stepCreate')}</li>
          <li>{t('avatars.stepPaste')}</li>
          <li>{t('avatars.stepWait')}</li>
        </ol>
        <button
          type="button"
          disabled={!canManage || isPreview || challenge?.status === 'pending'}
          onClick={create}
        >
          {t('avatars.create')}
        </button>
        {isPreview ? (
          <div className="pairing-token preview-token">
            {t('avatars.previewValue')}
          </div>
        ) : null}
        {challenge?.pairingToken ? (
          <div className="pairing-token" role="status">
            <span>{t('avatars.tokenLabel')}</span>
            <code>{challenge.pairingToken}</code>
            <button type="button" onClick={() => void copy()}>
              {t('avatars.copy')}
            </button>
            {copyFeedback ? (
              <p
                aria-live={copyFeedback === 'failure' ? 'assertive' : 'polite'}
                role={copyFeedback === 'failure' ? 'alert' : 'status'}
              >
                {t(
                  copyFeedback === 'success'
                    ? 'avatars.copySuccess'
                    : 'avatars.copyFailed',
                )}
              </p>
            ) : null}
            <p aria-live="off">
              {t('avatars.expires')}: {remaining}s
            </p>
            <button type="button" onClick={cancel}>
              {t('avatars.cancel')}
            </button>
          </div>
        ) : null}
        {challenge?.status === 'pending' ? (
          <p role="status">{t('avatars.pending')}</p>
        ) : null}
        {challenge?.status === 'expired' ? <p>{t('avatars.expired')}</p> : null}
        {challenge?.status === 'cancelled' ? (
          <p>{t('avatars.cancelled')}</p>
        ) : null}
        {error ? <p role="alert">{t('avatars.error')}</p> : null}
      </section>
      <section className="avatar-panel">
        <h2>{t('avatars.linked')}</h2>
        {avatars.length === 0 ? (
          <p>{isPreview ? t('avatars.previewAvatar') : t('avatars.empty')}</p>
        ) : (
          avatars.map((avatar) => (
            <article className="avatar-card" key={avatar.id}>
              <strong>{avatar.displayName ?? avatar.avatarUuid}</strong>
              <code>{avatar.avatarUuid}</code>
              {canManage ? (
                <button type="button" onClick={() => revoke(avatar)}>
                  {t('avatars.revoke')}
                </button>
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
