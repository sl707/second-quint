/**
 * Which IP addresses are on the public internet, so a server-side fetch of a link a player
 * pasted can't reach the server's own network.
 */

/** IPv4 ranges that aren't public: [first address, prefix length]. */
const NON_PUBLIC_IPV4: [string, number][] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, including cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved and broadcast
];

function parseIpv4(text: string): number | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255) return null;
    value = value * 256 + Number(part);
  }
  return value;
}

function isPublicIpv4(value: number): boolean {
  return NON_PUBLIC_IPV4.every(([start, prefix]) => {
    const size = 2 ** (32 - prefix);
    return Math.floor(value / size) !== Math.floor(parseIpv4(start)! / size);
  });
}

/** The eight 16-bit groups of an IPv6 address, or null if it isn't one. */
function parseIpv6(text: string): number[] | null {
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const groups = (half: string): number[] | null => {
    if (!half) return [];
    const out: number[] = [];
    const parts = half.split(":");
    for (const [i, part] of parts.entries()) {
      if (i === parts.length - 1 && part.includes(".")) {
        const v4 = parseIpv4(part);
        if (v4 === null) return null;
        out.push(Math.floor(v4 / 65536), v4 % 65536);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
        out.push(parseInt(part, 16));
      }
    }
    return out;
  };
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  if (!head || !tail) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - tail.length;
  return missing >= 1 ? [...head, ...Array<number>(missing).fill(0), ...tail] : null;
}

function isPublicIpv6(g: number[]): boolean {
  // IPv4-mapped (::ffff:a.b.c.d): judged as the IPv4 address it carries.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPublicIpv4(g[6] * 65536 + g[7]);
  // Only global unicast (2000::/3) is public; that excludes loopback, unspecified, IPv4-compatible,
  // NAT64, unique-local, link-local, and multicast.
  if (g[0] >> 13 !== 0b001) return false;
  if (g[0] === 0x2001 && g[1] < 0x200) return false; // IETF protocol assignments, including Teredo
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (g[0] === 0x2002) return false; // 6to4, which carries an IPv4 address
  if (g[0] === 0x3fff && g[1] < 0x1000) return false; // documentation
  return true;
}

/** Whether `address` (IPv4 or IPv6, as text) is on the public internet. Anything unparseable isn't. */
export function isPublicAddress(address: string): boolean {
  const v4 = parseIpv4(address);
  if (v4 !== null) return isPublicIpv4(v4);
  const v6 = address.includes(":") ? parseIpv6(address.replace(/%.*$/, "")) : null;
  return v6 !== null && isPublicIpv6(v6);
}
