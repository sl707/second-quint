import { describe, expect, it } from "vitest";
import { isPublicAddress } from "./address";

describe("public internet addresses", () => {
  it("allows ordinary public IPv4 and IPv6 addresses", () => {
    for (const address of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111", "2a00:1450:4001:80b::200e"]) {
      expect(isPublicAddress(address), address).toBe(true);
    }
  });

  it("refuses private, loopback, link-local, and other internal IPv4 addresses", () => {
    for (const address of [
      "0.0.0.0",
      "10.1.2.3",
      "100.64.0.1",
      "127.0.0.1",
      "127.255.255.254",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.0.0.8",
      "192.0.2.1",
      "192.168.1.1",
      "198.18.0.1",
      "198.51.100.7",
      "203.0.113.9",
      "224.0.0.1",
      "240.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it("refuses internal IPv6 addresses, including IPv4 ones written as IPv6", () => {
    for (const address of [
      "::",
      "::1",
      "0:0:0:0:0:0:0:1",
      "fe80::1",
      "fe80::1%en0",
      "fc00::1",
      "fd12:3456::1",
      "ff02::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:10.0.0.1",
      "::127.0.0.1",
      "64:ff9b::7f00:1",
      "2001:db8::1",
      "2001::1",
      "2002:7f00:1::1",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it("allows a public IPv4 address written as IPv6", () => {
    expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true);
  });

  it("refuses anything that isn't an IP address", () => {
    for (const address of ["", "localhost", "example.com", "1.2.3", "1.2.3.256", "::g", "1::2::3"]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });
});
