import {
  centerSquareCrop,
  checkPictureFile,
  PICTURE_SIZES,
  STORED_PICTURE_QUALITY,
  type PictureSize,
} from "@/domain/picture/picture";

/** The chosen file can't be used; the message is safe to show. */
export class PictureError extends Error {}

export type ResizedPictureBlobs = Record<`picture${PictureSize}`, Blob>;

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, STORED_PICTURE_QUALITY));
}

/**
 * Shrinks a picture in the browser to the stored center-cropped squares, 512 and 128 px, as WebP
 * (JPEG where the browser can't encode WebP). Animated GIFs keep only their first frame.
 */
export async function resizePicture(file: Blob): Promise<ResizedPictureBlobs> {
  const checked = checkPictureFile(file);
  if (!checked.ok) throw new PictureError(checked.reason);

  let bitmap: ImageBitmap;
  try {
    // Decodes only the first frame of an animated picture.
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PictureError("That file couldn't be read as a picture.");
  }

  const crop = centerSquareCrop(bitmap.width, bitmap.height);
  let source: CanvasImageSource = bitmap;
  let sourceCrop = crop;
  const result: Partial<ResizedPictureBlobs> = {};
  for (const size of PICTURE_SIZES) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, sourceCrop.left, sourceCrop.top, sourceCrop.size, sourceCrop.size, 0, 0, size, size);

    const webp = await encode(canvas, "image/webp");
    const blob = webp?.type === "image/webp" ? webp : await encode(canvas, "image/jpeg");
    if (!blob) throw new PictureError("That picture couldn't be resized.");
    result[`picture${size}`] = blob;

    // Each smaller size is drawn from the previous one, which keeps downscaling smooth.
    source = canvas;
    sourceCrop = { left: 0, top: 0, size };
  }
  bitmap.close();
  return result as ResizedPictureBlobs;
}
