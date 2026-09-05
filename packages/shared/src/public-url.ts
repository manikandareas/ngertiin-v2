import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export type PublicUrlFailureReason =
  | "invalid_url"
  | "unsupported_protocol"
  | "credentials_not_allowed"
  | "localhost_not_allowed"
  | "address_not_public"
  | "dns_lookup_failed";

export class PublicUrlError extends Error {
  constructor(readonly reason: PublicUrlFailureReason) {
    super("The URL must identify a public HTTP or HTTPS resource.");
    this.name = "PublicUrlError";
  }
}

const blockedAddresses = new BlockList();
const allowedIpv6 = new BlockList();
allowedIpv6.addSubnet("2000::", 3, "ipv6");
allowedIpv6.addSubnet("::ffff:0:0", 96, "ipv6");

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:20::", 28],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["5f00::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

export async function assertPublicHttpUrl(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PublicUrlError("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PublicUrlError("unsupported_protocol");
  }
  if (url.username || url.password) throw new PublicUrlError("credentials_not_allowed");

  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new PublicUrlError("localhost_not_allowed");
  }

  let addresses = [{ address: hostname }];
  if (isIP(hostname) === 0) {
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new PublicUrlError("dns_lookup_failed");
    }
    if (addresses.length === 0) throw new PublicUrlError("dns_lookup_failed");
  }
  for (const { address } of addresses) {
    const family = isIP(address);
    if (
      family === 0 ||
      (family === 6 && !allowedIpv6.check(address, "ipv6")) ||
      blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6")
    ) {
      throw new PublicUrlError("address_not_public");
    }
  }

  return url.toString();
}
