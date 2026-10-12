import { describe, expect, it } from "vitest";
import { centerSquareCrop, checkPictureFile, sniffPictureType, storedPictureType } from "./picture";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])));

describe("picture type from its bytes", () => {
  it("recognizes JPG, PNG, WebP, and GIF", () => {
    expect(sniffPictureType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("image/jpeg");
    expect(sniffPictureType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("image/png");
    expect(sniffPictureType(bytes("RIFF", 0x24, 0, 0, 0, "WEBPVP8 "))).toBe("image/webp");
    expect(sniffPictureType(bytes("GIF89a", 1, 0))).toBe("image/gif");
    expect(sniffPictureType(bytes("GIF87a", 1, 0))).toBe("image/gif");
  });

  it("refuses anything else, whatever it claims to be", () => {
    expect(sniffPictureType(bytes("<!doctype html><html>"))).toBeNull();
    expect(sniffPictureType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffPictureType(bytes("RIFF", 0x24, 0, 0, 0, "WAVEfmt "))).toBeNull();
    expect(sniffPictureType(bytes(0x89, "PN"))).toBeNull();
    expect(sniffPictureType(new Uint8Array())).toBeNull();
  });
});

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
