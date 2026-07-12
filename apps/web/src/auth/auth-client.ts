export const previewMode = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

export const authDestination = (session: {
  needsOnboarding: boolean;
}): '/' | '/onboarding' => (session.needsOnboarding ? '/onboarding' : '/');

export interface BrowserSession {
  needsOnboarding: boolean;
  user: { displayName: string; id: string; status: string };
  workspaces: Array<{ id: string; name: string; role: string; slug: string }>;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class UnauthenticatedError extends Error {}

export const getCurrentSession = async (
  fetcher: typeof fetch = fetch,
  isPreview = previewMode,
): Promise<BrowserSession> => {
  if (isPreview) throw new Error('PREVIEW_MODE');
  const response = await fetcher(`${apiUrl}/auth/session`, {
    credentials: 'include',
    method: 'GET',
  });
  if (response.status === 401) throw new UnauthenticatedError();
  if (!response.ok) throw new Error('AUTH_REQUEST_FAILED');
  return (await response.json()) as BrowserSession;
};

export const logoutSession = async (
  fetcher: typeof fetch = fetch,
  isPreview = previewMode,
): Promise<void> => {
  if (isPreview) throw new Error('PREVIEW_MODE');
  const response = await fetcher(`${apiUrl}/auth/logout`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error('AUTH_REQUEST_FAILED');
};

export const postAuth = async <T>(
  path: string,
  body: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<T> => {
  if (previewMode) throw new Error('PREVIEW_MODE');
  const response = await fetcher(`${apiUrl}${path}`, {
    body: JSON.stringify(body),
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error('AUTH_REQUEST_FAILED');
  return (await response.json()) as T;
};
