import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Memory-hard scrypt parameters (~64 MiB). Encoded with the hash so they can be raised later.
const N = 2 ** 16;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 160 * 1024 * 1024;

function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  opts: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(keyB64, "base64url");
  const key = await scrypt(
    password.normalize("NFKC"),
    Buffer.from(saltB64, "base64url"),
    expected.length,
    {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAXMEM,
    },
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A precomputed hash used to keep login timing uniform when the account does not exist. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

/** Length-based policy per NIST SP 800-63B; returns an error message or null. */
export function passwordPolicyError(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (/^(.)\1+$/.test(password)) return "Avoid repeating a single character.";
  if (email && password.toLowerCase().includes(email.toLowerCase().split("@")[0] ?? "\u0000"))
    return "Do not include your email name in the password.";
  const common = [
    "password",
    "123456789012",
    "qwertyuiopas",
    "letmein",
    "welcome",
    "administrator",
  ];
  if (common.some((c) => password.toLowerCase().includes(c)))
    return "This password is too easy to guess.";
  return null;
}
