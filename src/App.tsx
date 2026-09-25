import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';

type MarketState = 'ALIGNED' | 'CONSENSUS_MOVE' | 'DISLOCATION' | 'MIXED';

type ReferenceQuote = {
  symbol: string;
  price: number;
  changePct: number | null;
  currency: string;
  exchange: string | null;
  updatedAt: string | null;
  source: string;
  sourceUrl: string;
};

type WrapperQuote = {
  family: 'xstock' | 'ondo';
  symbol: string;
  mint: string;
  name: string;
  price: number | null;
  liquidity: number | null;
  volume24h: number | null;
  holders: number | null;
  verified: boolean;
  updatedAt: string | null;
  source: string;
  sourceUrl: string;
};

type MarketAsset = {
  symbol: string;
  name: string;
  marketSession: string;
  reference: ReferenceQuote | null;
  xstock: WrapperQuote | null;
  ondo: WrapperQuote | null;
  xstockGapPct: number | null;
  ondoGapPct: number | null;
  referenceDivergencePct: number | null;
  wrapperSpreadPct: number | null;
  state: MarketState;
  warnings: string[];
};

type MarketPayload = {
  live: boolean;
  fetchedAt: string;
  refreshSeconds: number;
  assets: MarketAsset[];
  methodology: {
    reference: string;
    wrappers: string;
    state: string;
  };
};

const money = (value: number | null | undefined) => value == null
  ? 'N/A'
  : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

const compactMoney = (value: number | null | undefined) => value == null
  ? 'N/A'
  : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);

const pct = (value: number | null | undefined, signed = false) => value == null
  ? 'N/A'
  : `${signed && value > 0 ? '+' : ''}${value.toFixed(2)}%`;

const time = (value: string | null | undefined) => value
  ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : 'N/A';

function StateBadge({ state }: { state: MarketState }) {
  const cls = state === 'ALIGNED'
    ? 'border-ok/50 bg-ok/10 text-ok'
    : state === 'CONSENSUS_MOVE'
      ? 'border-sev-info/50 bg-sev-info/10 text-sev-info'
      : state === 'DISLOCATION'
        ? 'border-sev-high/60 bg-sev-high/10 text-sev-high'
        : 'border-sev-watch/50 bg-sev-watch/10 text-sev-watch';

  return <span className={`mono inline-flex border px-2 py-1 text-[9px] font-semibold tracking-[0.12em] ${cls}`}>
    {state.replace('_', ' ')}
  </span>;
}

function Panel({ title, right, children, className = '' }: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>
    {(title || right) && <header className="flex items-center justify-between gap-3 border-b border-border bg-panel-raised/60 px-3 py-2">
      <h2 className="label-xs text-foreground/70">{title}</h2>
      {right}
    </header>}
    <div className="p-3">{children}</div>
  </section>;
}

function Stat({ label, value, sub, tone = 'default' }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: 'default' | 'high' | 'ok' | 'info' | 'watch';
}) {
  const color = tone === 'high' ? 'text-sev-high' : tone === 'ok' ? 'text-ok' : tone === 'info' ? 'text-sev-info' : tone === 'watch' ? 'text-sev-watch' : 'text-foreground';
  return <div className="panel px-3 py-3">
    <div className="label-xs">{label}</div>
    <div className={`readout mt-2 text-[28px] ${color}`}>{value}</div>
    {sub && <div className="mono mt-2 text-[9px] text-muted-foreground">{sub}</div>}
  </div>;
}

function useMarkets() {
  const [data, setData] = useState<MarketPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/markets', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setData(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { data, error, loading, refresh };
}

function Shell({ children, data, error, refresh }: {
  children: React.ReactNode;
  data: MarketPayload | null;
  error: string | null;
  refresh: () => Promise<void>;
}) {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1380px] flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="mono text-[15px] font-bold tracking-[0.2em]">STOCK<span className="text-accent">GAP</span></Link>
        <span className="mono inline-flex items-center gap-1.5 border border-ok/40 bg-ok/10 px-2 py-1 text-[9px] tracking-[0.14em] text-ok">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" /> LIVE DATA
        </span>
        <span className="mono hidden text-[9px] text-muted-foreground sm:inline">
          Yahoo reference · Jupiter verified Solana tokens
        </span>
        <nav className="mono ml-auto flex gap-1 text-[9px] tracking-[0.12em]">
          <Link to="/" className="border border-border px-2 py-1.5 text-muted-foreground hover:border-accent hover:text-accent">MONITOR</Link>
          <Link to="/dislocations" className="border border-border px-2 py-1.5 text-muted-foreground hover:border-accent hover:text-accent">DISLOCATIONS</Link>
          <button onClick={() => void refresh()} className="border border-accent/50 bg-accent/10 px-2 py-1.5 text-accent">REFRESH</button>
        </nav>
      </div>
      <div className="border-t border-border/60 px-4 py-1.5">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-3 mono text-[8.5px] text-muted-foreground">
          <span>{error ? <span className="text-sev-high">DATA ERROR: {error}</span> : 'END-TO-END LIVE MARKET COMPARISON'}</span>
          <span>FETCHED {data ? time(data.fetchedAt) : '—'}</span>
        </div>
      </div>
    </header>
    <main className="mx-auto w-full max-w-[1380px] px-3 py-4 sm:px-4">{children}</main>
    <footer className="mx-auto max-w-[1380px] border-t border-border px-4 py-4 mono text-[9px] leading-5 text-muted-foreground">
      StockGap is read-only market intelligence. Prices are observational, may be delayed or thinly traded, and are not financial advice.
    </footer>
  </div>;
}

function Hero() {
  return <section className="panel bezel grid-radar relative overflow-hidden px-5 py-8">
    <div className="pointer-events-none absolute inset-0 scanline opacity-30" />
    <div className="relative">
      <div className="mono text-[10px] tracking-[0.2em] text-live">SOLANA TOKENIZED EQUITY INTELLIGENCE</div>
      <h1 className="mono mt-4 max-w-5xl text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
        WHEN A TOKENIZED STOCK MOVES,<br /><span className="text-accent">IS THE MARKET AGREEING?</span>
      </h1>
      <p className="mt-4 max-w-3xl text-[13px] leading-6 text-muted-foreground">
        StockGap compares a live U.S. equity reference with verified xStock and Ondo representations on Solana, then classifies whether the observed move is aligned, confirmed across wrappers, isolated to one wrapper, or mixed.
      </p>
    </div>
  </section>;
}

function Monitor({ data, loading }: { data: MarketPayload | null; loading: boolean }) {
  const assets = data?.assets ?? [];
  const dislocations = assets.filter((a) => a.state === 'DISLOCATION').length;
  const consensus = assets.filter((a) => a.state === 'CONSENSUS_MOVE').length;
  const largest = assets.reduce((m, a) => Math.max(m, a.wrapperSpreadPct ?? 0), 0);

  return <>
    <Hero />
    <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Stat label="Assets monitored" value={loading ? '—' : assets.length} tone="info" sub="Reference + two Solana wrappers" />
      <Stat label="Dislocations" value={loading ? '—' : dislocations} tone="high" sub="Wrapper spread ≥ 2.5%" />
      <Stat label="Consensus moves" value={loading ? '—' : consensus} tone="info" sub="Both wrappers move together" />
      <Stat label="Largest wrapper spread" value={loading ? '—' : pct(largest)} tone={largest >= 2.5 ? 'high' : 'default'} sub="xStock vs Ondo" />
    </div>

    <Panel className="mt-2" title="LIVE CROSS-MARKET MONITOR" right={<span className="mono text-[8.5px] text-ok">AUTO-REFRESH 15S</span>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left">
          <thead><tr className="border-b border-border label-xs text-[8px]">
            <th className="px-2 py-2">Asset</th>
            <th className="px-2 py-2">Reference</th>
            <th className="px-2 py-2">xStock</th>
            <th className="px-2 py-2">Ondo</th>
            <th className="px-2 py-2">xStock gap</th>
            <th className="px-2 py-2">Ondo gap</th>
            <th className="px-2 py-2">Wrapper spread</th>
            <th className="px-2 py-2">Session</th>
            <th className="px-2 py-2">State</th>
          </tr></thead>
          <tbody>{assets.map((asset) => <tr key={asset.symbol} className="border-b border-border/60 text-[11px] hover:bg-panel-raised/40">
            <td className="px-2 py-3"><Link to={`/asset/${asset.symbol}`} className="mono font-semibold text-foreground hover:text-accent">{asset.symbol}<span className="ml-2 text-[9px] font-normal text-muted-foreground">{asset.name}</span></Link></td>
            <td className="mono px-2 py-3">{money(asset.reference?.price)}</td>
            <td className="mono px-2 py-3">{money(asset.xstock?.price)}{asset.xstock?.verified && <span className="ml-1 text-ok">✓</span>}</td>
            <td className="mono px-2 py-3">{money(asset.ondo?.price)}{asset.ondo?.verified && <span className="ml-1 text-ok">✓</span>}</td>
            <td className="mono px-2 py-3 text-muted-foreground">{pct(asset.xstockGapPct, true)}</td>
            <td className="mono px-2 py-3 text-muted-foreground">{pct(asset.ondoGapPct, true)}</td>
            <td className="mono px-2 py-3 font-semibold text-foreground">{pct(asset.wrapperSpreadPct)}</td>
            <td className="mono px-2 py-3 text-[9px] text-muted-foreground">{asset.marketSession}</td>
            <td className="px-2 py-3"><StateBadge state={asset.state} /></td>
          </tr>)}</tbody>
        </table>
        {!assets.length && <div className="p-8 text-center mono text-[10px] text-muted-foreground">{loading ? 'LOADING LIVE MARKETS…' : 'NO MARKET DATA'}</div>}
      </div>
    </Panel>

    <Panel className="mt-2" title="HOW TO READ IT">
      <div className="grid gap-2 md:grid-cols-4">
        <div className="panel-sunk p-3"><StateBadge state="ALIGNED" /><p className="mt-3 text-[10.5px] leading-5 text-muted-foreground">Both wrappers remain close to the reference and to each other.</p></div>
        <div className="panel-sunk p-3"><StateBadge state="CONSENSUS_MOVE" /><p className="mt-3 text-[10.5px] leading-5 text-muted-foreground">Both wrappers move materially in the same direction while staying close to each other.</p></div>
        <div className="panel-sunk p-3"><StateBadge state="DISLOCATION" /><p className="mt-3 text-[10.5px] leading-5 text-muted-foreground">One wrapper separates enough from the other to cross the configured spread threshold.</p></div>
        <div className="panel-sunk p-3"><StateBadge state="MIXED" /><p className="mt-3 text-[10.5px] leading-5 text-muted-foreground">The relationship does not fit the other deterministic states.</p></div>
      </div>
    </Panel>
  </>;
}

function Detail({ data }: { data: MarketPayload | null }) {
  const { symbol = '' } = useParams();
  const asset = data?.assets.find((item) => item.symbol === symbol.toUpperCase());
  const [copied, setCopied] = useState(false);

  const read = useMemo(() => {
    if (!asset) return '';
    if (asset.state === 'DISLOCATION') return 'The two observed Solana wrappers are materially separated. This move is not confirmed across both wrappers.';
    if (asset.state === 'CONSENSUS_MOVE') return 'Both observed Solana wrappers are repricing materially in the same direction while remaining close to each other.';
    if (asset.state === 'ALIGNED') return 'Both observed Solana wrappers remain close to the U.S. equity reference and to each other.';
    return 'The observed markets disagree, but the relationship does not meet the configured consensus-move or dislocation thresholds.';
  }, [asset]);

  if (!asset) return <Panel title="ASSET"><p className="mono text-[10px] text-muted-foreground">Loading {symbol.toUpperCase()}…</p></Panel>;

  const receipt = {
    capturedAt: data?.fetchedAt,
    symbol: asset.symbol,
    marketSession: asset.marketSession,
    reference: asset.reference,
    xstock: asset.xstock,
    ondo: asset.ondo,
    metrics: {
      xstockGapPct: asset.xstockGapPct,
      ondoGapPct: asset.ondoGapPct,
      wrapperSpreadPct: asset.wrapperSpreadPct,
      state: asset.state,
    },
    warnings: asset.warnings,
  };

  const copyReceipt = async () => {
    await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return <>
    <div className="mb-3"><Link to="/" className="mono text-[10px] text-muted-foreground hover:text-accent">← CROSS-MARKET MONITOR</Link></div>
    <section className="panel bezel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="label-xs">LIVE ASSET READ</div>
          <h1 className="mono mt-2 text-3xl font-bold">{asset.symbol} <span className="text-muted-foreground">{asset.name}</span></h1>
          <div className="mono mt-3 text-[10px] text-muted-foreground">U.S. MARKET {asset.marketSession} · FETCHED {time(data?.fetchedAt)}</div>
        </div>
        <StateBadge state={asset.state} />
      </div>
    </section>

    <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Stat label="Reference" value={money(asset.reference?.price)} tone="info" sub={asset.reference?.exchange ?? 'U.S. equity'} />
      <Stat label={asset.xstock?.symbol ?? 'xStock'} value={money(asset.xstock?.price)} sub={`Liquidity ${compactMoney(asset.xstock?.liquidity)}`} />
      <Stat label={asset.ondo?.symbol ?? 'Ondo'} value={money(asset.ondo?.price)} sub={`Liquidity ${compactMoney(asset.ondo?.liquidity)}`} />
      <Stat label="Wrapper spread" value={pct(asset.wrapperSpreadPct)} tone={(asset.wrapperSpreadPct ?? 0) >= 2.5 ? 'high' : 'default'} sub="xStock vs Ondo" />
    </div>

    <div className="mt-2 grid gap-2 lg:grid-cols-[1.1fr_0.9fr]">
      <Panel title="CROSS-MARKET READ" right={<StateBadge state={asset.state} />}>
        <p className="text-[13px] leading-6">{read}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="panel-sunk p-3"><div className="label-xs">Reference</div><div className="readout mt-2 text-xl">{money(asset.reference?.price)}</div><div className="mono mt-2 text-[9px] text-muted-foreground">{time(asset.reference?.updatedAt)}</div></div>
          <div className="panel-sunk p-3"><div className="label-xs">xStock gap</div><div className="readout mt-2 text-xl text-accent">{pct(asset.xstockGapPct, true)}</div><div className="mono mt-2 text-[9px] text-muted-foreground">{time(asset.xstock?.updatedAt)}</div></div>
          <div className="panel-sunk p-3"><div className="label-xs">Ondo gap</div><div className="readout mt-2 text-xl text-accent">{pct(asset.ondoGapPct, true)}</div><div className="mono mt-2 text-[9px] text-muted-foreground">{time(asset.ondo?.updatedAt)}</div></div>
        </div>
        {asset.warnings.length > 0 && <div className="mt-4 border border-sev-watch/40 bg-sev-watch/5 p-3">
          <div className="label-xs text-sev-watch">DATA QUALITY NOTES</div>
          {asset.warnings.map((warning) => <div key={warning} className="mono mt-2 text-[9.5px] text-sev-watch">{warning}</div>)}
        </div>}
      </Panel>

      <Panel title="LIVE SOURCE RECEIPT" right={<button onClick={() => void copyReceipt()} className="mono border border-border-bright px-2 py-1 text-[8.5px] text-muted-foreground hover:border-accent hover:text-accent">{copied ? 'COPIED' : 'COPY JSON'}</button>}>
        <div className="space-y-4 text-[10px]">
          <div><div className="label-xs">Traditional reference</div><div className="mono mt-1">{asset.reference?.source}</div><div className="mono mt-1 text-muted-foreground">{asset.reference?.updatedAt ?? 'N/A'}</div></div>
          <div><div className="label-xs">xStock · verified {asset.xstock?.verified ? 'yes' : 'no'}</div><div className="mono mt-1 break-all text-foreground">{asset.xstock?.mint}</div><div className="mono mt-1 text-muted-foreground">Liquidity {compactMoney(asset.xstock?.liquidity)} · 24h volume {compactMoney(asset.xstock?.volume24h)}</div></div>
          <div><div className="label-xs">Ondo · verified {asset.ondo?.verified ? 'yes' : 'no'}</div><div className="mono mt-1 break-all text-foreground">{asset.ondo?.mint}</div><div className="mono mt-1 text-muted-foreground">Liquidity {compactMoney(asset.ondo?.liquidity)} · 24h volume {compactMoney(asset.ondo?.volume24h)}</div></div>
        </div>
      </Panel>
    </div>
  </>;
}

function Dislocations({ data }: { data: MarketPayload | null }) {
  const rows = [...(data?.assets ?? [])].sort((a, b) => (b.wrapperSpreadPct ?? -1) - (a.wrapperSpreadPct ?? -1));
  return <>
    <section className="panel bezel px-5 py-6">
      <div className="label-xs">LIVE RANKING</div>
      <h1 className="mono mt-2 text-3xl font-bold">CROSS-MARKET DISLOCATIONS</h1>
      <p className="mt-3 max-w-3xl text-[12px] leading-6 text-muted-foreground">Largest observed xStock vs Ondo price separation, normalized to the live U.S. equity reference. Liquidity is shown because a large spread on a thin market should be interpreted differently from one on a deep market.</p>
    </section>
    <Panel className="mt-2" title="WRAPPER SPREAD RANKING">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[11px]">
          <thead><tr className="border-b border-border label-xs text-[8px]"><th className="px-2 py-2">Rank</th><th className="px-2 py-2">Asset</th><th className="px-2 py-2">Spread</th><th className="px-2 py-2">xStock liquidity</th><th className="px-2 py-2">Ondo liquidity</th><th className="px-2 py-2">State</th><th className="px-2 py-2">Notes</th></tr></thead>
          <tbody>{rows.map((asset, index) => <tr key={asset.symbol} className="border-b border-border/60">
            <td className="mono px-2 py-3 text-muted-foreground">{String(index + 1).padStart(2, '0')}</td>
            <td className="px-2 py-3"><Link to={`/asset/${asset.symbol}`} className="mono font-semibold hover:text-accent">{asset.symbol}</Link></td>
            <td className="mono px-2 py-3 font-semibold">{pct(asset.wrapperSpreadPct)}</td>
            <td className="mono px-2 py-3 text-muted-foreground">{compactMoney(asset.xstock?.liquidity)}</td>
            <td className="mono px-2 py-3 text-muted-foreground">{compactMoney(asset.ondo?.liquidity)}</td>
            <td className="px-2 py-3"><StateBadge state={asset.state} /></td>
            <td className="mono px-2 py-3 text-[9px] text-sev-watch">{asset.warnings.length ? asset.warnings.join(' · ') : '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </Panel>
  </>;
}

export default function App() {
  const markets = useMarkets();

  return <Shell data={markets.data} error={markets.error} refresh={markets.refresh}>
    <Routes>
      <Route path="/" element={<Monitor data={markets.data} loading={markets.loading} />} />
      <Route path="/asset/:symbol" element={<Detail data={markets.data} />} />
      <Route path="/dislocations" element={<Dislocations data={markets.data} />} />
      <Route path="*" element={<Monitor data={markets.data} loading={markets.loading} />} />
    </Routes>
  </Shell>;
}
