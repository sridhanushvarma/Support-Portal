import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../db";
import { recordAudit } from "../audit";
import type { SessionUser } from "../auth/session";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { mediaStorage } from "./storage";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 2400;
const MAX_INPUT_PIXELS = 40_000_000; // decompression-bomb guard

type Detected = "image/jpeg" | "image/png" | "image/webp" | null;

/** Identify file type from magic bytes; the filename and client MIME type are ignored (BR-15). */
export function detectImageType(buf: Buffer): Detected {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  return null;
}

/**
 * Validate and store an image (FR-ADM-008). The image is fully decoded and
 * re-encoded: this verifies it is a genuine image, strips EXIF/GPS metadata,
 * and neutralises payloads hidden in the original file.
 */
export async function uploadImage(
  user: SessionUser,
  file: File,
  altText: string,
  requestId?: string,
) {
  if (!user.permissions.has("media.upload")) throw ForbiddenError();
  const alt = altText.trim();
  if (alt.length < 3 || alt.length > 250) {
    throw ValidationError("Describe the image for people who cannot see it (3–250 characters).", {
      altText: ["Add meaningful alternative text (3–250 characters)."],
    });
  }
  if (!file || file.size === 0)
    throw ValidationError("Choose an image to upload.", { file: ["Choose an image."] });
  if (file.size > MAX_UPLOAD_BYTES)
    throw ValidationError("Images must be 5 MB or smaller.", {
      file: ["Images must be 5 MB or smaller."],
    });
  const input = Buffer.from(await file.arrayBuffer());
  const detected = detectImageType(input);
  if (!detected)
    throw ValidationError("Only JPEG, PNG and WebP images are accepted.", {
      file: ["Only JPEG, PNG and WebP images are accepted."],
    });

  let output: Buffer;
  let width: number;
  let height: number;
  try {
    const pipeline = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate() // apply EXIF orientation before metadata is dropped
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      });
    const result = await pipeline.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    output = result.data;
    width = result.info.width;
    height = result.info.height;
  } catch {
    throw ValidationError("The file could not be read as an image.", {
      file: ["The file is damaged or not a supported image."],
    });
  }

  const id = randomUUID();
  const storageKey = `${id}.webp`;
  await mediaStorage().put(storageKey, output);
  try {
    const asset = await prisma.mediaAsset.create({
      data: {
        id,
        storageKey,
        originalName: file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 200) || "upload",
        mimeType: "image/webp",
        sizeBytes: output.length,
        width,
        height,
        altText: alt,
        scanStatus: "reencoded",
        uploadedById: user.id,
      },
    });
    await recordAudit({
      actor: user,
      action: "media.uploaded",
      entityType: "media",
      entityId: id,
      requestId,
      metadata: { detected, bytes: output.length },
    });
    return asset;
  } catch (e) {
    await mediaStorage().remove(storageKey);
    throw e;
  }
}

export async function updateAltText(user: SessionUser, id: string, altText: string) {
  if (!user.permissions.has("media.upload")) throw ForbiddenError();
  const alt = altText.trim();
  if (alt.length < 3 || alt.length > 250)
    throw ValidationError("Alternative text must be 3–250 characters.", {
      altText: ["Use 3–250 characters."],
    });
  await prisma.mediaAsset.update({ where: { id }, data: { altText: alt } });
}

/** Delete an unused asset. Assets referenced by content (draft or live) are protected. */
export async function deleteMedia(user: SessionUser, id: string, requestId?: string) {
  if (!user.permissions.has("media.manage")) throw ForbiddenError();
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) throw NotFoundError();
  const usedAsThumb = await prisma.project.count({ where: { thumbnailId: id } });
  const usedInContent = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM "Project" WHERE "content"::text LIKE ${`%${id}%`} OR coalesce("published"::text, '') LIKE ${`%${id}%`}`;
  if (usedAsThumb > 0 || Number(usedInContent[0]?.n ?? 0) > 0) {
    throw ConflictError(
      "This image is used by a project (draft or live). Remove it from the project first.",
    );
  }
  await prisma.mediaAsset.delete({ where: { id } });
  await mediaStorage().remove(asset.storageKey);
  await recordAudit({
    actor: user,
    action: "media.deleted",
    entityType: "media",
    entityId: id,
    requestId,
  });
}
