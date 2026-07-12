import {
  argon2,
  createHash,
  randomBytes,
  timingSafeEqual,
  type Argon2Parameters,
} from 'node:crypto';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const ARGON2_PARAMETERS = {
  memory: 65_536,
  parallelism: 1,
  passes: 3,
  tagLength: 32,
} as const;

const derive = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const parameters: Argon2Parameters = {
      ...ARGON2_PARAMETERS,
      message: Buffer.from(password, 'utf8'),
      nonce: salt,
    };
    argon2('argon2id', parameters, (error, result) =>
      error ? reject(error) : resolve(result),
    );
  });

export const validatePasswordPolicy = (password: string): boolean =>
  password.length >= PASSWORD_MIN_LENGTH &&
  password.length <= PASSWORD_MAX_LENGTH;

export const hashPassword = async (password: string): Promise<string> => {
  if (!validatePasswordPolicy(password))
    throw new Error('Invalid password length');
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `$argon2id$v=19$m=65536,t=3,p=1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
};

export const verifyPassword = async (
  encoded: string,
  password: string,
): Promise<boolean> => {
  const parts = encoded.split('$');
  if (
    parts.length !== 6 ||
    parts[1] !== 'argon2id' ||
    parts[2] !== 'v=19' ||
    parts[3] !== 'm=65536,t=3,p=1'
  ) {
    return false;
  }
  try {
    const expected = Buffer.from(parts[5] ?? '', 'base64url');
    const actual = await derive(
      password,
      Buffer.from(parts[4] ?? '', 'base64url'),
    );
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
};

export const generateSessionToken = (): string =>
  randomBytes(32).toString('base64url');
export const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');
export const fingerprintEmail = (emailNormalized: string): string =>
  createHash('sha256').update(emailNormalized, 'utf8').digest('hex');

export interface CookieSecurityConfig {
  cookieName: string;
  maxAgeSeconds: number;
  secure: boolean;
}

export const sessionCookie = (
  token: string,
  config: CookieSecurityConfig,
): string =>
  `${config.cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.maxAgeSeconds}${config.secure ? '; Secure' : ''}`;

export const expiredSessionCookie = (config: CookieSecurityConfig): string =>
  `${config.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.secure ? '; Secure' : ''}`;

export const readCookie = (
  header: string | undefined,
  name: string,
): string | undefined =>
  header
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)
    ?.slice(1)
    .join('=');

export const isAllowedMutationOrigin = (
  origin: string | undefined,
  allowedOrigin: string,
): boolean => origin === allowedOrigin;
