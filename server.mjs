import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ASSETS = [
  {
    symbol: 'AAPL', name: 'Apple Inc.',
    pyth: {
      reference: { symbol: 'Equity.US.AAPL/USD', id: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688' },
      xstock: { symbol: 'Crypto.AAPLX/USD', id: '978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675' },
      ondo: { symbol: 'Crypto.AAPLON/USD', id: 'e6734de88a83d9d2fb33072adab319004700aefd069653aba30ba9e3cac056f2' },
    },
    xstock: { symbol: 'AAPLx', mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp' },
    ondo: { symbol: 'AAPLon', mint: '123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo' },
  },
  {
    symbol: 'NVDA', name: 'NVIDIA Corp.',
    pyth: {
      reference: { symbol: 'Equity.US.NVDA/USD', id: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593' },
      xstock: { symbol: 'Crypto.NVDAX/USD', id: '4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f' },
      ondo: { symbol: 'Crypto.NVDAON/USD', id: '207ddea2a443d30b7e13a7c88a9e3f106765deb97049afc65a18cede50fffc82' },
    },
    xstock: { symbol: 'NVDAx', mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh' },
    ondo: { symbol: 'NVDAon', mint: 'gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo' },
  },
  {
    symbol: 'TSLA', name: 'Tesla Inc.',
    pyth: {
      reference: { symbol: 'Equity.US.TSLA/USD', id: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1' },
      xstock: { symbol: 'Crypto.TSLAX/USD', id: '47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362' },
      ondo: { symbol: 'Crypto.TSLAON/USD', id: 'c09ef687ed07091c047da444f1499f2da52cdc1c085104643ec565a9eb1af514' },
    },
    xstock: { symbol: 'TSLAx', mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB' },
    ondo: { symbol: 'TSLAon', mint: 'KeGv7bsfR4MheC1CkmnAVceoApjrkvBhHYjWb67ondo' },
  },
  {
    symbol: 'GOOGL', name: 'Alphabet Inc. Class A',
    pyth: {
      reference: { symbol: 'Equity.US.GOOGL/USD', id: '5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6' },
      xstock: { symbol: 'Crypto.GOOGLX/USD', id: 'b911b0329028cd0283e4259c33809d62942bd2716a58084e5f31d64c00b5424e' },
      ondo: { symbol: 'Crypto.GOOGLON/USD', id: 'ad79b3487bef87ff8f8ab31c0b779ad08d931fdfa5436f7e92a234bb82bff7e4' },
    },
    xstock: { symbol: 'GOOGLx', mint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN' },
    ondo: { symbol: 'GOOGLon', mint: 'bbahNA5vT9WJeYft8tALrH1LXWffjwqVoUbqYa1ondo' },
  },
  {
    symbol: 'MSFT', name: 'Microsoft Corp.',
    pyth: {
      reference: { symbol: 'Equity.US.MSFT/USD', id: 'd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1' },
      xstock: { symbol: 'Crypto.MSFTX/USD', id: 'bb723a70af731ab56b9a650eb7e8ac22b7bc07ea77f8670bd1fa9a37bf6df3f5' },
      ondo: { symbol: 'Crypto.MSFTON/USD', id: '29b228e9fd72bbd306bcca3b10c165d8dba5d535ef8d5aab6c6e4bc18912d150' },
    },
    xstock: { symbol: 'MSFTx', mint: 'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX' },
    ondo: { symbol: 'MSFTon', mint: 'FRmH6iRkMr33DLG6zVLR7EM4LojBFAuq6NtFzG6ondo' },
  },
];

const pythApiKey = process.env.PYTH_PRO_API_KEY || process.env.PYTH_API_KEY || null;
const pythHermesBase = 'https://pyth.dourolabs.app/hermes';

const apiOnly = process.argv.includes('--api-only');
const port = Number(apiOnly ? (process.env.API_PORT || 8787) : (process.env.PORT || 4177));
const cacheMs = 10_000;
let cache = null;
let cacheAt = 0;

function sessionAt(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));

  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return 'CLOSED';
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  if (minutes >= 570 && minutes < 960) return 'OPEN';
  if (minutes >= 240 && minutes < 570) return 'PREMARKET';
  if (minutes >= 960 && minutes < 1200) return 'AFTER_HOURS';
  return 'CLOSED';
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'StockGap/0.1 (+https://github.com/ProjectB59/stockgap)',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).host}`);
  return response.json();
}

async function pythQuote(feed) {
  if (!pythApiKey) throw new Error('Pyth API key not configured');

  const url = pythHermesBase + '/v2/updates/price/latest?ids[]=' + encodeURIComponent(feed.id) + '&parsed=true';
  const response = await fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + pythApiKey,
      'Accept': 'application/json',
      'User-Agent': 'StockGap/0.1 (+https://github.com/ProjectB59/stockgap)',
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error('Pyth ' + response.status + ': ' + (message || 'price unavailable'));
  }

  const body = await response.json();
  const record = body?.parsed?.[0];
  const rawPrice = Number(record?.price?.price);
  const exponent = Number(record?.price?.expo);
  if (!Number.isFinite(rawPrice) || !Number.isFinite(exponent)) {
    throw new Error('Pyth returned no parsed price for ' + feed.symbol);
  }

  const price = rawPrice * (10 ** exponent);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Pyth returned invalid price for ' + feed.symbol);
  }

  const publishTime = Number(record?.price?.publish_time);
  return {
    price,
    updatedAt: Number.isFinite(publishTime) ? new Date(publishTime * 1000).toISOString() : null,
    source: 'Pyth Network',
    sourceUrl: 'https://www.pyth.network/price-feeds',
    pythFeedId: feed.id,
    pythSymbol: feed.symbol,
  };
}

async function referenceQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const body = await fetchJson(url);
  const meta = body?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`No live reference price for ${symbol}`);

  return {
    symbol,
    price,
    changePct: Number.isFinite(Number(meta?.regularMarketChangePercent)) ? Number(meta.regularMarketChangePercent) : null,
    currency: meta?.currency || 'USD',
    exchange: meta?.fullExchangeName || meta?.exchangeName || null,
    updatedAt: meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    source: 'Yahoo Finance chart endpoint',
    sourceUrl: `https://finance.yahoo.com/quote/${symbol}/`,
  };
}

async function solanaWrapper(definition, family) {
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${definition.mint}`;
  const body = await fetchJson(url);
  const token = Array.isArray(body) ? body.find((item) => item?.id === definition.mint) : null;
  if (!token) throw new Error(`Jupiter did not return ${definition.symbol}`);

  const price = Number(token.usdPrice);
  const liquidity = Number(token.liquidity);
  const stats = token.stats24h || {};
  const volume24h = Number(stats.buyVolume || 0) + Number(stats.sellVolume || 0);

  return {
    family,
    symbol: definition.symbol,
    mint: definition.mint,
    name: token.name || definition.symbol,
    price: Number.isFinite(price) && price > 0 ? price : null,
    liquidity: Number.isFinite(liquidity) ? liquidity : null,
    volume24h: Number.isFinite(volume24h) ? volume24h : null,
    holders: Number.isFinite(Number(token.holderCount)) ? Number(token.holderCount) : null,
    verified: token.isVerified === true,
    updatedAt: token.updatedAt || null,
    source: 'Jupiter Tokens V2',
    sourceUrl: `https://jup.ag/tokens/${definition.mint}`,
  };
}

function compute(reference, xstock, ondo) {
  if (!reference?.price || !xstock?.price || !ondo?.price) {
    return {
      xstockGapPct: null,
      ondoGapPct: null,
      referenceDivergencePct: null,
      wrapperSpreadPct: null,
      state: 'MIXED',
    };
  }

  const xstockGapPct = ((xstock.price - reference.price) / reference.price) * 100;
  const ondoGapPct = ((ondo.price - reference.price) / reference.price) * 100;
  const wrapperSpreadPct = (Math.abs(xstock.price - ondo.price) / reference.price) * 100;
  const referenceDivergencePct = Math.max(Math.abs(xstockGapPct), Math.abs(ondoGapPct));

  let state = 'MIXED';
  if (wrapperSpreadPct >= 2.5) state = 'DISLOCATION';
  else if (
    Math.abs(xstockGapPct) >= 1.5
    && Math.abs(ondoGapPct) >= 1.5
    && Math.sign(xstockGapPct) === Math.sign(ondoGapPct)
    && wrapperSpreadPct <= 1
  ) state = 'CONSENSUS_MOVE';
  else if (referenceDivergencePct <= 0.75 && wrapperSpreadPct <= 0.75) state = 'ALIGNED';

  return { xstockGapPct, ondoGapPct, referenceDivergencePct, wrapperSpreadPct, state };
}

async function settle(promise) {
  try {
    return { value: await promise, error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function buildMarketData() {
  if (cache && Date.now() - cacheAt < cacheMs) return cache;

  const marketSession = sessionAt();
  const assets = await Promise.all(ASSETS.map(async (asset) => {
    const [
      pythReferenceResult,
      pythXstockResult,
      pythOndoResult,
      fallbackReferenceResult,
      jupiterXstockResult,
      jupiterOndoResult,
    ] = await Promise.all([
      settle(pythQuote(asset.pyth.reference)),
      settle(pythQuote(asset.pyth.xstock)),
      settle(pythQuote(asset.pyth.ondo)),
      settle(referenceQuote(asset.symbol)),
      settle(solanaWrapper(asset.xstock, 'xstock')),
      settle(solanaWrapper(asset.ondo, 'ondo')),
    ]);

    const fallbackReference = fallbackReferenceResult.value;
    const reference = pythReferenceResult.value
      ? {
          ...fallbackReference,
          symbol: asset.symbol,
          price: pythReferenceResult.value.price,
          changePct: fallbackReference?.changePct ?? null,
          currency: 'USD',
          exchange: fallbackReference?.exchange || 'U.S. equity',
          updatedAt: pythReferenceResult.value.updatedAt,
          source: pythReferenceResult.value.source,
          sourceUrl: pythReferenceResult.value.sourceUrl,
          pythFeedId: pythReferenceResult.value.pythFeedId,
          pythSymbol: pythReferenceResult.value.pythSymbol,
        }
      : fallbackReference;

    const makeWrapper = (family, definition, pythResult, jupiterResult) => {
      const market = jupiterResult.value;
      if (pythResult.value) {
        return {
          ...(market || {
            family,
            symbol: definition.symbol,
            mint: definition.mint,
            name: definition.symbol,
            liquidity: null,
            volume24h: null,
            holders: null,
            verified: false,
          }),
          family,
          symbol: definition.symbol,
          mint: definition.mint,
          price: pythResult.value.price,
          updatedAt: pythResult.value.updatedAt,
          source: 'Pyth Network + Jupiter Tokens V2',
          sourceUrl: pythResult.value.sourceUrl,
          priceSource: 'Pyth Network',
          marketDataSource: market ? 'Jupiter Tokens V2' : null,
          pythFeedId: pythResult.value.pythFeedId,
          pythSymbol: pythResult.value.pythSymbol,
        };
      }
      return market ? { ...market, priceSource: 'Jupiter Tokens V2', marketDataSource: 'Jupiter Tokens V2' } : null;
    };

    const xstock = makeWrapper('xstock', asset.xstock, pythXstockResult, jupiterXstockResult);
    const ondo = makeWrapper('ondo', asset.ondo, pythOndoResult, jupiterOndoResult);
    const metrics = compute(reference, xstock, ondo);
    const warnings = [];

    if (!reference && fallbackReferenceResult.error) warnings.push(fallbackReferenceResult.error);
    if (!xstock && jupiterXstockResult.error) warnings.push(jupiterXstockResult.error);
    if (!ondo && jupiterOndoResult.error) warnings.push(jupiterOndoResult.error);
    if (xstock && xstock.verified !== true) warnings.push(xstock.symbol + ' is not verified by Jupiter');
    if (ondo && ondo.verified !== true) warnings.push(ondo.symbol + ' is not verified by Jupiter');
    if (xstock?.liquidity !== null && xstock?.liquidity < 10_000) warnings.push(xstock.symbol + ' has thin observed liquidity');
    if (ondo?.liquidity !== null && ondo?.liquidity < 10_000) warnings.push(ondo.symbol + ' has thin observed liquidity');

    return {
      symbol: asset.symbol,
      name: asset.name,
      marketSession,
      reference,
      xstock,
      ondo,
      ...metrics,
      warnings,
    };
  }));

  cache = {
    live: true,
    fetchedAt: new Date().toISOString(),
    refreshSeconds: cacheMs / 1000,
    assets,
    providers: {
      pythConfigured: Boolean(pythApiKey),
      pythActiveFeeds: assets.reduce((count, item) => count
        + (item.reference?.source === 'Pyth Network' ? 1 : 0)
        + (item.xstock?.priceSource === 'Pyth Network' ? 1 : 0)
        + (item.ondo?.priceSource === 'Pyth Network' ? 1 : 0), 0),
    },
    methodology: {
      reference: 'Pyth Network is the preferred U.S. equity price source; Yahoo Finance is the fallback reference.',
      wrappers: 'Pyth Network is the preferred xStock/Ondo price source; Jupiter Tokens V2 supplies fallback prices plus liquidity, volume and verification context.',
      state: 'Deterministic comparison of the selected traditional reference, xStock and Ondo token prices.',
    },
  };
  cacheAt = Date.now();
  return cache;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload));
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function serveStatic(pathname, res) {
  const relative = pathname.startsWith('/assets/') ? pathname.slice(1) : 'index.html';
  const file = join(process.cwd(), 'dist', relative);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    const body = await readFile(join(process.cwd(), 'dist', 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'stockgap', live: true, time: new Date().toISOString() });
  }

  if (url.pathname === '/api/markets') {
    try {
      return sendJson(res, 200, await buildMarketData());
    } catch (error) {
      return sendJson(res, 502, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (apiOnly) return sendJson(res, 404, { error: 'Not found' });
  return serveStatic(url.pathname, res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`StockGap ${apiOnly ? 'API' : 'app'} listening on http://localhost:${port}`);
});
