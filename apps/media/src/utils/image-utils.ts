// src/lib/image-utils.ts
import sharp from "sharp";

export type ImageVariantBuffers = {
  normalized: Buffer;
  small: Buffer;
};

export type ImageMeta = {
  width?: number;
  height?: number;
  size?: number;
  format?: string | undefined;
};

/**
 * Normalize image: rotate, constrain width <= maxWidth, convert to webp with quality.
 * Also create square 128x128 avatar.
 */
export async function processProfileImage(inputBuffer: Buffer, opts?: { maxWidth?: number; quality?: number }) : Promise<{ buffers: ImageVariantBuffers; metas: { normalized: ImageMeta; small: ImageMeta } }> {
  const maxWidth = opts?.maxWidth ?? 2048;
  const quality = opts?.quality ?? 80;

  const image = sharp(inputBuffer);

  const normalizedBuffer = await image
    .clone()
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  const smallBuffer = await image
    .clone()
    .rotate()
    .resize(128, 128, { fit: "cover" })
    .webp({ quality })
    .toBuffer();

  const normMeta = await sharp(normalizedBuffer).metadata();
  const smallMeta = await sharp(smallBuffer).metadata();

  return {
    buffers: { normalized: normalizedBuffer, small: smallBuffer },
    metas: {
      normalized: { width: normMeta.width, height: normMeta.height, size: normalizedBuffer.length, format: normMeta.format },
      small: { width: smallMeta.width, height: smallMeta.height, size: smallBuffer.length, format: smallMeta.format },
    }
  };
}
