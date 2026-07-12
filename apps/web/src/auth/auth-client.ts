export const previewMode = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

export const authDestination = (session: {
  needsOnboarding: boolean;
}): '/' | '/onboarding' => (session.needsOnboarding ? '/onboarding' : '/');

export const postAuth = async <T>(
  path: string,
  body: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<T> => {
  if (previewMode) throw new Error('PREVIEW_MODE');
  const response = await fetcher(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${path}`,
    {
      body: JSON.stringify(body),
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    },
  );
  if (!response.ok) throw new Error('AUTH_REQUEST_FAILED');
  return (await response.json()) as T;
};
