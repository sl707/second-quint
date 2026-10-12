import { describe, expect, it } from "vitest";
import { centerSquareCrop, checkPictureFile, storedPictureType } from "./picture";

describe("center square crop", () => {
  it("keeps the middle of a wide picture", () => {
    expect(centerSquareCrop(1600, 900)).toEqual({ left: 350, top: 0, size: 900 });
  });

  it("keeps the middle of a tall picture", () => {
    expect(centerSquareCrop(300, 501)).toEqual({ left: 0, top: 100, size: 300 });
  });

  it("keeps all of a square picture", () => {
    expect(centerSquareCrop(512, 512)).toEqual({ left: 0, top: 0, size: 512 });
  });
});

describe("accepted pictures", () => {
  it("accepts JPG, PNG, WebP, and GIF up to 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(checkPictureFile({ type, size: 5 * 1024 * 1024 })).toEqual({ ok: true });
    }
  });

  it("refuses other types and anything over 5 MB", () => {
    expect(checkPictureFile({ type: "image/svg+xml", size: 100 }).ok).toBe(false);
    expect(checkPictureFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 }).ok).toBe(false);
  });
});

describe("stored picture type", () => {
  it("recognizes WebP and JPEG bytes and nothing else", () => {
    const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8 ")]);
    expect(storedPictureType(webp)).toBe("image/webp");
    expect(storedPictureType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(storedPictureType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});
