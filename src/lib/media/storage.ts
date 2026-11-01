import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

/**
 * Local filesystem storage (mount a persistent volume in production). The
 * interface is small so an S3-compatible driver can replace it without
 * touching callers (spec 10.1, File/media storage).
 */
export interface MediaStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-f0-9-]{36}\.(webp|jpg|png)$/;

function resolveKey(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
  const root = path.resolve(env().MEDIA_STORAGE_DIR);
  return path.join(root, key.slice(0, 2), key);
}

export const localStorage: MediaStorage = {
  async put(key, data) {
    const file = resolveKey(key);
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, data, { mode: 0o640 });
    await rename(tmp, file); // atomic publish of the file
  },
  async get(key) {
    try {
      return await readFile(resolveKey(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  },
  async remove(key) {
    await unlink(resolveKey(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
  },
};

export const mediaStorage = (): MediaStorage => localStorage;
