import { NextResponse } from "next/server";

interface QuoteMetric {
  price: number;
  changePct?: number;
  source: string;
  symbol: string;
}

async function fetchYahooQuote(ticker: string): Promise<{ price: number; changePct?: number } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;

    const price = meta.regularMarketPrice;
    const prevClose =
      typeof meta.chartPreviousClose === "number"
        ? meta.chartPreviousClose
        : typeof meta.previousClose === "number"
          ? meta.previousClose
          : undefined;

    const changePct =
      prevClose && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : undefined;

    return {
      price,
      changePct: changePct !== undefined ? Math.round(changePct * 100) / 100 : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchBtcQuote(): Promise<QuoteMetric | null> {
  // 1. Try Yahoo Finance BTC-USD
  const yh = await fetchYahooQuote("BTC-USD");
  if (yh) {
    return {
      price: Math.round(yh.price),
      changePct: yh.changePct,
      source: "Yahoo Finance",
      symbol: "BTC/USD",
    };
  }

  // 2. Fallback: CoinGecko
  try {
    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      { cache: "no-store" }
    );
    if (cgRes.ok) {
      const cgData = await cgRes.json();
      if (typeof cgData?.bitcoin?.usd === "number") {
        return {
          price: Math.round(cgData.bitcoin.usd),
          changePct:
            typeof cgData.bitcoin.usd_24h_change === "number"
              ? Math.round(cgData.bitcoin.usd_24h_change * 100) / 100
              : undefined,
          source: "CoinGecko",
          symbol: "BTC/USD",
        };
      }
    }
  } catch {}

  // 3. Fallback: Coinbase Spot
  try {
    const cbRes = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot", {
      cache: "no-store",
    });
    if (cbRes.ok) {
      const cbData = await cbRes.json();
      const amount = parseFloat(cbData?.data?.amount);
      if (!Number.isNaN(amount)) {
        return {
          price: Math.round(amount),
          source: "Coinbase",
          symbol: "BTC/USD",
        };
      }
    }
  } catch {}

  return null;
}

async function fetchCrudeOilQuote(): Promise<QuoteMetric | null> {
  // 1. Try Yahoo Finance WTI Crude Futures (CL=F)
  const wti = await fetchYahooQuote("CL=F");
  if (wti) {
    return {
      price: Math.round(wti.price * 100) / 100,
      changePct: wti.changePct,
      source: "NYMEX WTI",
      symbol: "WTI/USD",
    };
  }

  // 2. Fallback: Brent Crude Futures (BZ=F)
  const brent = await fetchYahooQuote("BZ=F");
  if (brent) {
    return {
      price: Math.round(brent.price * 100) / 100,
      changePct: brent.changePct,
      source: "ICE Brent",
      symbol: "BRENT/USD",
    };
  }

  // 3. Fallback: Stooq WTI Crude CSV
  try {
    const stooqRes = await fetch("https://stooq.com/q/l/?s=cl.f&f=sd2t2ohlcv&h&e=csv", {
      cache: "no-store",
    });
    if (stooqRes.ok) {
      const csv = await stooqRes.text();
      const lines = csv.trim().split("\n");
      if (lines.length >= 2) {
        const cols = lines[1].split(",");
        const open = parseFloat(cols[3]);
        const close = parseFloat(cols[6]);
        if (!Number.isNaN(close) && close > 0) {
          const changePct =
            !Number.isNaN(open) && open > 0
              ? Math.round(((close - open) / open) * 10000) / 100
              : undefined;
          return {
            price: Math.round(close * 100) / 100,
            changePct,
            source: "Stooq WTI",
            symbol: "WTI/USD",
          };
        }
      }
    }
  } catch {}

  return null;
}

async function fetchUsdToPkrQuote(): Promise<QuoteMetric | null> {
  // 1. Try Yahoo Finance PKR=X (real-time interbank rate + daily delta)
  const yh = await fetchYahooQuote("PKR=X");
  if (yh && yh.price > 50) {
    return {
      price: Math.round(yh.price * 100) / 100,
      changePct: yh.changePct,
      source: "Interbank FX",
      symbol: "USD/PKR",
    };
  }

  // 2. Fallback: Open Exchange Rates API (no key required)
  try {
    const erRes = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
    });
    if (erRes.ok) {
      const erData = await erRes.json();
      const rate = erData?.rates?.PKR;
      if (typeof rate === "number" && rate > 50) {
        return {
          price: Math.round(rate * 100) / 100,
          source: "OpenFX",
          symbol: "USD/PKR",
        };
      }
    }
  } catch {}

  // 3. Fallback: Fawazahmed0 Currency API via jsDelivr CDN
  try {
    const cdnRes = await fetch(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
      { cache: "no-store" }
    );
    if (cdnRes.ok) {
      const cdnData = await cdnRes.json();
      const rate = cdnData?.usd?.pkr;
      if (typeof rate === "number" && rate > 50) {
        return {
          price: Math.round(rate * 100) / 100,
          source: "Global FX",
          symbol: "USD/PKR",
        };
      }
    }
  } catch {}

  return null;
}

export async function GET(request: Request) {
  void request.url;
  const [btc, crudeOil, usdPkr] = await Promise.all([
    fetchBtcQuote(),
    fetchCrudeOilQuote(),
    fetchUsdToPkrQuote(),
  ]);

  return NextResponse.json({
    btc,
    crudeOil,
    usdPkr,
    updatedAt: new Date().toISOString(),
  });
}

