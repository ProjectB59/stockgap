import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ASSETS = [
  {
    symbol: 'AAPL', name: 'Apple Inc.',
    xstock: { symbol: 'AAPLx', mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp' },
    ondo: { symbol: 'AAPLon', mint: '123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo' },
  },
  {
    symbol: 'NVDA', name: 'NVIDIA Corp.',
    xstock: { symbol: 'NVDAx', mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh' },
    ondo: { symbol: 'NVDAon', mint: 'gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo' },
  },
  {
    symbol: 'TSLA', name: 'Tesla Inc.',
    xstock: { symbol: 'TSLAx', mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB' },
    ondo: { symbol: 'TSLAon', mint: 'KeGv7bsfR4MheC1CkmnAVceoApjrkvBhHYjWb67ondo' },
  },
  {
    symbol: 'GOOGL', name: 'Alphabet Inc. Class A',
    xstock: { symbol: 'GOOGLx', mint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN' },
    ondo: { symbol: 'GOOGLon', mint: 'bbahNA5vT9WJeYft8tALrH1LXWffjwqVoUbqYa1ondo' },
  },
  {
    symbol: 'MSFT', name: 'Microsoft Corp.',
    xstock: { symbol: 'MSFTx', mint: 'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX' },
    ondo: { symbol: 'MSFTon', mint: 'FRmH6iRkMr33DLG6zVLR7EM4LojBFAuq6NtFzG6ondo' },
  },
];

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
    const [referenceResult, xResult, ondoResult] = await Promise.all([
      settle(referenceQuote(asset.symbol)),
      settle(solanaWrapper(asset.xstock, 'xstock')),
      settle(solanaWrapper(asset.ondo, 'ondo')),
    ]);

    const reference = referenceResult.value;
    const xstock = xResult.value;
    const ondo = ondoResult.value;
    const metrics = compute(reference, xstock, ondo);
    const warnings = [];

    if (referenceResult.error) warnings.push(referenceResult.error);
    if (xResult.error) warnings.push(xResult.error);
    if (ondoResult.error) warnings.push(ondoResult.error);
    if (xstock && xstock.verified !== true) warnings.push(`${xstock.symbol} is not verified by Jupiter`);
    if (ondo && ondo.verified !== true) warnings.push(`${ondo.symbol} is not verified by Jupiter`);
    if (xstock?.liquidity !== null && xstock?.liquidity < 10_000) warnings.push(`${xstock.symbol} has thin observed liquidity`);
    if (ondo?.liquidity !== null && ondo?.liquidity < 10_000) warnings.push(`${ondo.symbol} has thin observed liquidity`);

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
    methodology: {
      reference: 'Live U.S. equity quote from Yahoo Finance chart endpoint.',
      wrappers: 'Live verified Solana token price and liquidity from Jupiter Tokens V2.',
      state: 'Deterministic comparison of traditional reference, xStock and Ondo token prices.',
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
