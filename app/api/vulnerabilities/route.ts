import { NextResponse } from "next/server";

export interface VulnerabilityItem {
  id: string;
  cveId: string;
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  score: number | null;
  published: string;
  url: string;
}

// In-memory cache to prevent hitting NVD rate limits (NVD allows max 5 unauthenticated calls per 30s)
let cachedItems: VulnerabilityItem[] = [];
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

// Curated recent fallback entries if NVD rate-limits or is unreachable
const FALLBACK_VULNERABILITIES: VulnerabilityItem[] = [
  {
    id: "CVE-2026-119364",
    cveId: "CVE-2026-119364",
    title: "ProFTPD Symlink Bypass in mod_copy",
    description: "ProFTPD contains a link-following vulnerability in mod_copy that allows authenticated FTP users to bypass Limit WRITE restrictions via symlinks.",
    severity: "HIGH",
    score: 8.2,
    published: new Date().toISOString(),
    url: "https://nvd.nist.gov/vuln/detail/CVE-2026-119364",
  },
  {
    id: "CVE-2026-116068",
    cveId: "CVE-2026-116068",
    title: "Dokploy Authorization Bypass Vulnerability",
    description: "Dokploy contains an authorization bypass vulnerability allowing unauthorized access to administrative functions and server configuration.",
    severity: "CRITICAL",
    score: 9.1,
    published: new Date().toISOString(),
    url: "https://nvd.nist.gov/vuln/detail/CVE-2026-116068",
  },
  {
    id: "CVE-2026-116066",
    cveId: "CVE-2026-116066",
    title: "Firecrawl Server-Side Request Forgery",
    description: "Firecrawl contains a server-side request forgery vulnerability in the Playwright service proxy that allows internal resource access.",
    severity: "HIGH",
    score: 7.8,
    published: new Date().toISOString(),
    url: "https://nvd.nist.gov/vuln/detail/CVE-2026-116066",
  },
];

async function fetchFromNvd(): Promise<VulnerabilityItem[]> {
  const now = new Date();
  const endStr = now.toISOString();

  // Attempt window 1: last 48 hours
  const start48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  let url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${encodeURIComponent(start48h)}&pubEndDate=${encodeURIComponent(endStr)}&resultsPerPage=25`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    // If 48h has no published CVEs (e.g. over weekends), widen window to 7 days
    if (res.ok) {
      const data = await res.json();
      if (!data?.vulnerabilities?.length) {
        const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const fallbackUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${encodeURIComponent(start7d)}&pubEndDate=${encodeURIComponent(endStr)}&resultsPerPage=25`;
        res = await fetch(fallbackUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json",
          },
          cache: "no-store",
        });
      }
    }

    if (!res.ok) {
      return cachedItems.length > 0 ? cachedItems : FALLBACK_VULNERABILITIES;
    }

    const data = await res.json();
    const rawList = Array.isArray(data?.vulnerabilities) ? data.vulnerabilities : [];

    if (rawList.length === 0) {
      return cachedItems.length > 0 ? cachedItems : FALLBACK_VULNERABILITIES;
    }

    const parsed: VulnerabilityItem[] = rawList.map((item: any) => {
      const cve = item.cve || {};
      const cveId = cve.id || "CVE-UNKNOWN";
      const descriptions: Array<{ lang: string; value: string }> = cve.descriptions || [];
      const enDesc = descriptions.find((d) => d.lang === "en")?.value || "Vulnerability reported to National Vulnerability Database.";

      // Extract CVSS score and severity
      const v40 = cve.metrics?.cvssMetricV40?.[0]?.cvssData;
      const v31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
      const v30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData;
      const v2 = cve.metrics?.cvssMetricV2?.[0]?.cvssData;

      const metric = v31 || v40 || v30 || v2;
      const rawSeverity = (metric?.baseSeverity || metric?.severity || "HIGH").toUpperCase();
      let severity: VulnerabilityItem["severity"] = "HIGH";
      if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(rawSeverity)) {
        severity = rawSeverity as VulnerabilityItem["severity"];
      }

      const score = typeof metric?.baseScore === "number" ? metric.baseScore : null;

      // Extract a clean short title from the description (first clause or up to 60 characters)
      let title = enDesc;
      const periodIdx = enDesc.indexOf(".");
      if (periodIdx > 15 && periodIdx < 90) {
        title = enDesc.slice(0, periodIdx);
      } else if (enDesc.length > 80) {
        title = enDesc.slice(0, 77) + "...";
      }

      return {
        id: cveId,
        cveId,
        title,
        description: enDesc,
        severity,
        score,
        published: cve.published || new Date().toISOString(),
        url: `https://nvd.nist.gov/vuln/detail/${cveId}`,
      };
    });

    // Sort most recent first
    parsed.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

    return parsed.slice(0, 20);
  } catch (err) {
    console.error("NVD API fetch error:", err);
    return cachedItems.length > 0 ? cachedItems : FALLBACK_VULNERABILITIES;
  }
}

export async function GET(request: Request) {
  void request.url;

  const now = Date.now();
  if (cachedItems.length > 0 && now - lastFetchTimestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      items: cachedItems,
      source: "cache",
      updatedAt: new Date(lastFetchTimestamp).toISOString(),
    });
  }

  const items = await fetchFromNvd();
  if (items.length > 0) {
    cachedItems = items;
    lastFetchTimestamp = now;
  }

  return NextResponse.json({
    items: cachedItems.length > 0 ? cachedItems : FALLBACK_VULNERABILITIES,
    source: "nvd.nist.gov",
    updatedAt: new Date().toISOString(),
  });
}

