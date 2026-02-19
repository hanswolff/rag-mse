import { NextRequest } from "next/server";

const IPV4_OCTET_COUNT = 4;
const BITS_PER_OCTET = 8;
const IPV4_TOTAL_BITS = 32;
const MAX_OCTET_VALUE = 255;
const FULL_IPV4_MASK = 0xffffffff;

interface IpRange {
  start: number;
  end: number;
  cidr: string;
}

let cachedTrustedRanges: IpRange[] | null = null;
let cachedTrustedIps: Set<string> | null = null;

const DEFAULT_TRUSTED_PROXY_IPS = "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16";

function toUnsigned32Bit(value: number): number {
  return value >>> 0;
}

function parseIpToNumber(ip: string): number | null {
  try {
    const normalizedIp = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
    const parts = normalizedIp.split(".");
    if (parts.length !== IPV4_OCTET_COUNT) return null;
    let result = 0;
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > MAX_OCTET_VALUE) return null;
      result = (result << BITS_PER_OCTET) + num;
    }
    return toUnsigned32Bit(result);
  } catch {
    return null;
  }
}

function parseCidr(cidr: string): IpRange | null {
  const [ipStr, prefixStr] = cidr.split("/");
  if (!ipStr || prefixStr === undefined) return null;

  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > IPV4_TOTAL_BITS) return null;

  const ip = parseIpToNumber(ipStr);
  if (ip === null) return null;

  const mask = prefix === 0 ? 0 : toUnsigned32Bit(FULL_IPV4_MASK << (IPV4_TOTAL_BITS - prefix));
  const start = toUnsigned32Bit(ip & mask);
  const end = toUnsigned32Bit(start | (~mask & FULL_IPV4_MASK));

  return { start, end, cidr };
}

function loadTrustedProxies(): { ranges: IpRange[]; ips: Set<string> } {
  if (cachedTrustedRanges !== null && cachedTrustedIps !== null) {
    return { ranges: cachedTrustedRanges, ips: cachedTrustedIps };
  }

  const envVar = process.env.TRUSTED_PROXY_IPS || DEFAULT_TRUSTED_PROXY_IPS;
  const entries = envVar.split(",").map((e) => e.trim()).filter((e) => e.length > 0);

  const ranges: IpRange[] = [];
  const ips = new Set<string>();

  for (const entry of entries) {
    if (entry.includes("/")) {
      const range = parseCidr(entry);
      if (range) ranges.push(range);
    } else {
      ips.add(entry);
    }
  }

  cachedTrustedRanges = ranges;
  cachedTrustedIps = ips;

  return { ranges, ips };
}

function isIpInRanges(ip: number, ranges: IpRange[]): boolean {
  return ranges.some((range) => ip >= range.start && ip <= range.end);
}

function isTrustedProxy(ip: string): boolean {
  if (!ip) return false;

  const { ranges, ips } = loadTrustedProxies();

  if (ips.has(ip)) return true;

  const ipNumber = parseIpToNumber(ip);
  if (ipNumber !== null && isIpInRanges(ipNumber, ranges)) {
    return true;
  }

  return false;
}

export function getClientIdentifier(request: NextRequest): string {
  const sourceIp = (request as NextRequest & { ip?: string | null }).ip || null;
  return getClientIdentifierFromHeaders(request.headers, sourceIp);
}

export function getClientIdentifierFromHeaders(headers: Headers, sourceIp: string | null = null): string {
  const xForwardedFor = headers.get("x-forwarded-for");
  const xRealIp = headers.get("x-real-ip");

  const isProxyTrusted = sourceIp ? isTrustedProxy(sourceIp) : false;

  if (isProxyTrusted && xForwardedFor) {
    const forwardedIps = xForwardedFor.split(",").map((ip) => ip.trim()).filter((ip) => ip.length > 0);
    if (forwardedIps.length > 0) {
      return forwardedIps[0];
    }
  }

  if (isProxyTrusted && xRealIp) {
    return xRealIp;
  }

  if (sourceIp) {
    return sourceIp;
  }

  return "fallback:unknown-client";
}

export function getDirectIp(request: NextRequest): string | null {
  return request.headers.get("x-real-ip") || null;
}

export function clearTrustedProxyCache(): void {
  cachedTrustedRanges = null;
  cachedTrustedIps = null;
}
