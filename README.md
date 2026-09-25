# StockGap

**Cross-market intelligence for tokenized stocks on Solana.**

StockGap answers one narrow question:

> When a tokenized stock moves, is that move being confirmed across multiple representations of the same equity, or is it isolated to one wrapper?

The app compares a live U.S. equity reference with verified **xStock** and **Ondo** token prices on Solana, then classifies the observed relationship as:

- **ALIGNED** — both wrappers remain close to the reference and to each other.
- **CONSENSUS MOVE** — both wrappers move materially in the same direction while remaining close to each other.
- **DISLOCATION** — the wrapper-to-wrapper spread crosses the configured threshold.
- **MIXED** — the relationship does not fit the other deterministic states.

StockGap is read-only. It does not execute trades or make price predictions.

## Live end-to-end demo

StockGap has a server-side **Pyth-first provider layer**.

When `PYTH_PRO_API_KEY` (or `PYTH_API_KEY`) is configured and entitled to the requested feeds:

1. The Node server requests the exact Pyth equity, xStock and Ondo price feeds through authenticated Pyth Hermes.
2. Pyth prices become the inputs to the StockGap comparison engine.
3. Jupiter Tokens V2 supplies Solana liquidity, 24h volume, mint verification and token-market context.
4. The server calculates signed reference gaps, wrapper spread and cross-market state.
5. The React frontend refreshes the live comparison every 15 seconds.
6. Each asset page exposes a copyable JSON market receipt with prices, timestamps, mints, metrics, sources and data-quality warnings.

If no Pyth key is configured, or a key is not entitled to a requested feed, StockGap falls back to Yahoo Finance for the U.S. equity reference and Jupiter for wrapper prices. That fallback keeps the public demo usable without committing a private credential or blanking the monitor when one provider is unavailable.

Thin liquidity is surfaced explicitly. A large observed wrapper spread on a thin market is not treated as equally strong evidence as a spread on deeper liquidity.

## Run it

Requires Node.js 20+.

```bash
git clone https://github.com/ProjectB59/stockgap.git
cd stockgap
npm install
npm run dev
```

To enable Pyth pricing, export the API key only in the server environment:

```bash
export PYTH_PRO_API_KEY="your-key"
npm run dev
```

The key is never sent to the browser and must not be committed to GitHub.

Open:

```text
http://localhost:5173
```

For the production build:

```bash
npm run build
npm start
```

Then open:

```text
http://localhost:4177
```

## Architecture

```text
Pyth Network (preferred prices)
   ├── U.S. equity feed
   ├── xStock feed
   └── Ondo feed
          │
          ▼
      StockGap API
          ▲
          │
          ├── Jupiter Tokens V2
          │      ├── liquidity / 24h volume
          │      ├── verified Solana mints
          │      └── fallback wrapper prices
          │
          └── Yahoo Finance
                 └── fallback U.S. equity reference
          │
          ▼
 deterministic comparison engine
          │
          ├── reference gaps
          ├── wrapper spread
          ├── liquidity warnings
          └── cross-market state
          │
          ▼
       React UI
```

The API caches upstream responses for 10 seconds, keeps Pyth credentials server-side, and tolerates partial provider failures so one missing quote does not blank the entire monitor.

## Verified Solana assets in the demo

| Equity | xStock | xStock mint | Ondo | Ondo mint |
|---|---|---|---|---|
| AAPL | AAPLx | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` | AAPLon | `123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo` |
| NVDA | NVDAx | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` | NVDAon | `gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo` |
| TSLA | TSLAx | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` | TSLAon | `KeGv7bsfR4MheC1CkmnAVceoApjrkvBhHYjWb67ondo` |
| GOOGL | GOOGLx | `XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN` | GOOGLon | `bbahNA5vT9WJeYft8tALrH1LXWffjwqVoUbqYa1ondo` |
| MSFT | MSFTx | `XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX` | MSFTon | `FRmH6iRkMr33DLG6zVLR7EM4LojBFAuq6NtFzG6ondo` |

The runtime requests these exact mints and checks Jupiter's `isVerified` field rather than trusting a ticker search result.

## State rules

For reference price `R`, xStock price `X`, and Ondo price `O`:

```text
xStock gap     = (X - R) / R × 100
Ondo gap       = (O - R) / R × 100
wrapper spread = |X - O| / R × 100
```

Current prototype thresholds:

- `DISLOCATION`: wrapper spread >= 2.5%
- `CONSENSUS_MOVE`: both wrappers at least 1.5% from reference, same direction, wrapper spread <= 1%
- `ALIGNED`: largest reference gap <= 0.75% and wrapper spread <= 0.75%
- otherwise `MIXED`

These are descriptive prototype thresholds, not trading signals.

## Why this matters

Tokenized equities trade on crypto rails that can remain active when the traditional reference market is closed. Looking at only one wrapper cannot tell you whether a move reflects broader cross-market repricing or a venue-specific dislocation.

StockGap puts the reference and multiple tokenized representations on one surface and preserves the context that matters: price, session, verification, liquidity, volume, timestamp and contract address.

## Pyth integration

Pyth is integrated as StockGap's preferred price provider behind the server boundary. The repository contains the exact Pyth feed mappings for all monitored markets:

| Equity | Pyth equity | Pyth xStock | Pyth Ondo |
|---|---|---|---|
| AAPL | `Equity.US.AAPL/USD` | `Crypto.AAPLX/USD` | `Crypto.AAPLON/USD` |
| NVDA | `Equity.US.NVDA/USD` | `Crypto.NVDAX/USD` | `Crypto.NVDAON/USD` |
| TSLA | `Equity.US.TSLA/USD` | `Crypto.TSLAX/USD` | `Crypto.TSLAON/USD` |
| GOOGL | `Equity.US.GOOGL/USD` | `Crypto.GOOGLX/USD` | `Crypto.GOOGLON/USD` |
| MSFT | `Equity.US.MSFT/USD` | `Crypto.MSFTX/USD` | `Crypto.MSFTON/USD` |

The server calls authenticated Pyth Hermes with the feed IDs and converts Pyth's fixed-point price representation into the decimal price used by the comparison engine. When Pyth is active, the UI identifies the Pyth source and feed symbol in the live source receipt.

Pyth access is entitlement-aware. If a supplied key does not have access to a requested feed, StockGap keeps running with the fallback providers instead of turning the comparison surface into an error page.

## Hackathon disclosure

StockGap is a standalone project built for the Stocklana hackathon.

**Pre-existing work:** the visual language and an earlier mock-only stock comparison concept were adapted from the broader Signal59 project.

**Work completed for StockGap:** the standalone repository, live server-side data pipeline, verified Solana token registry, deterministic cross-market engine, liquidity-aware warnings, live monitor, dislocation ranking, asset detail view, and copyable market receipt.

No private credentials are committed to this repository.

## Data notes

- Preferred price source: authenticated Pyth Network feeds when the server key is entitled to the requested feeds.
- Fallback traditional reference: Yahoo Finance chart endpoint.
- Solana token liquidity, volume and verification context: Jupiter Tokens V2.
- Fallback wrapper prices: Jupiter Tokens V2.
- Wrapper tokens may have very different liquidity. StockGap displays liquidity and warnings rather than hiding this.
- Source prices can be delayed, stale, thin or temporarily unavailable.
- This project is experimental market intelligence, not financial advice.
