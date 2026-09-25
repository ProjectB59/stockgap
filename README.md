# Stocklana

**Cross-market intelligence for tokenized stocks on Solana.**

Stocklana answers one narrow question:

> When a tokenized stock moves, is that move being confirmed across multiple representations of the same equity, or is it isolated to one wrapper?

The app compares a live U.S. equity reference with verified **xStock** and **Ondo** token prices on Solana, then classifies the observed relationship as:

- **ALIGNED** — both wrappers remain close to the reference and to each other.
- **CONSENSUS MOVE** — both wrappers move materially in the same direction while remaining close to each other.
- **DISLOCATION** — the wrapper-to-wrapper spread crosses the configured threshold.
- **MIXED** — the relationship does not fit the other deterministic states.

Stocklana is read-only. It does not execute trades or make price predictions.

## Live end-to-end demo

The default demo uses live data and requires **no private API key**:

1. A Node server fetches the current U.S. equity reference from the Yahoo Finance chart endpoint.
2. It fetches live Solana token price, liquidity, volume, verification status and update timestamps from Jupiter Tokens V2.
3. It compares the traditional reference, verified xStock and verified Ondo token.
4. The server calculates signed reference gaps, wrapper spread and cross-market state.
5. The React frontend refreshes the live comparison every 15 seconds.
6. Each asset page exposes a copyable JSON market receipt containing the observed prices, timestamps, mints, metrics and data-quality warnings.

Thin liquidity is surfaced explicitly. A large observed wrapper spread on a thin market is not treated as equally strong evidence as a spread on deeper liquidity.

## Run it

Requires Node.js 20+.

```bash
git clone https://github.com/ProjectB59/stocklana.git
cd stocklana
npm install
npm run dev
```

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
Yahoo Finance chart endpoint
          │
          ├── live U.S. equity reference
          │
          ▼
      Stocklana API
          ▲
          │
          ├── Jupiter Tokens V2
          │      ├── verified xStock
          │      └── verified Ondo token
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

The API caches upstream responses for 10 seconds and tolerates partial provider failures so one missing quote does not blank the entire monitor.

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

Stocklana puts the reference and multiple tokenized representations on one surface and preserves the context that matters: price, session, verification, liquidity, volume, timestamp and contract address.

## Pyth path

The earlier research prototype used verified Pyth equity, xStock and Ondo feed definitions. Pyth's current live HTTP products require authenticated server-side access, so the public default demo deliberately does **not** embed a Pyth credential in browser code or GitHub.

A production extension can replace or augment the current reference layer with authenticated Pyth feeds behind the same server boundary.

## Hackathon disclosure

Stocklana is a standalone hackathon project.

**Pre-existing work:** the visual language and an earlier mock-only stock comparison concept were adapted from the broader Signal59 project.

**Work completed for Stocklana:** the standalone repository, live server-side data pipeline, verified Solana token registry, deterministic cross-market engine, liquidity-aware warnings, live monitor, dislocation ranking, asset detail view, and copyable market receipt.

No private credentials are committed to this repository.

## Data notes

- Traditional reference: Yahoo Finance chart endpoint.
- Solana token market data: Jupiter Tokens V2.
- Wrapper tokens may have very different liquidity. Stocklana displays liquidity and warnings rather than hiding this.
- Source prices can be delayed, stale, thin or temporarily unavailable.
- This project is experimental market intelligence, not financial advice.
