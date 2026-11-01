import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "./env";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacHex(input: string, secret = env().APP_SECRET): string {
  return createHmac("sha256", secret).update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** One-way hash for IP addresses so rate limiting and sessions never store raw IPs. */
export function hashIp(ip: string): string {
  return hmacHex(`ip:${ip}`).slice(0, 32);
}

function key(): Buffer {
  return Buffer.from(env().APP_ENCRYPTION_KEY, "base64");
}

/** AES-256-GCM. Output: base64url(iv).base64url(tag).base64url(ciphertext) */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, ct] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !ct) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no ambiguous characters

/** Human-friendly, non-sequential reference such as ENQ-7K3M9QX2. */
export function humanReference(prefix = "ENQ", length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += REF_ALPHABET[bytes[i]! % REF_ALPHABET.length];
  return `${prefix}-${out}`;
}
