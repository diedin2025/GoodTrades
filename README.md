# GoodTrades Full-Stack Paper Trading Platform

React + Vite frontend with a Node backend that now includes multi-agent orchestration, paper portfolio APIs, backtesting, persistent trade memory, coaching summaries, drawing analysis, and realtime streaming.

## What it does

- Tracks a live or demo stock watchlist
- Polls the backend for updated quotes and trend history
- Stores paper trading and memory data in backend persistence (`backend/data/store.json`)
- Calculates portfolio positions, realized P&L, and unrealized P&L via API
- Surfaces rules-based trade ideas for each tracked symbol
- Optionally adds an AI watchlist brief when `GEMINI_API_KEY` is configured
- Runs 10-agent orchestration on demand (`/api/agents/query`)
- Runs strategy backtests over 30-session history (`/api/backtest/run`)
- Scores chart drawing confluence (`/api/drawings/analyze`)
- Streams live market/agent updates over SSE (`/api/stream/live`)

## API mode

The backend supports two modes:

- `demo`: works out of the box with seeded stock data
- `live`: enabled when `ALPHA_VANTAGE_API_KEY` is set

The live integration uses Alpha Vantage endpoints for:

- symbol search
- global quotes
- daily time series
- company overview

## Environment variables

- `ALPHA_VANTAGE_API_KEY` enables genuine market data
- `GEMINI_API_KEY` enables an optional AI note for the idea stream
- `GEMINI_MODEL` overrides the default Gemini model
- `PORT` overrides the backend port, default `8787`
- `HOST` overrides the backend host, default `127.0.0.1`

## Local development

1. Run `npm run dev:api`
2. Run `npm run dev`
3. Open the Vite app in your browser

The Vite dev server proxies `/api/*` to `http://127.0.0.1:8787`.

## API endpoints

- `GET /api/health`
- `POST /api/onboarding/profile`
- `GET /api/market/search?keywords=AAPL`
- `GET /api/market/watchlist?symbols=AAPL,MSFT,NVDA`
- `GET /api/market/symbol?symbol=TSLA`
- `POST /api/market/ideas`
- `POST /api/paper/orders`
- `GET /api/paper/portfolio`
- `POST /api/backtest/run`
- `GET /api/memory/timeline`
- `POST /api/agents/query`
- `POST /api/drawings/analyze`
- `GET /api/coach/summary?symbol=AAPL`
- `GET /api/stream/live`

OpenAPI reference: `backend/openapi.json`

Example request:

```bash
curl -X POST http://127.0.0.1:8787/api/market/ideas \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT", "NVDA"],
    "includeAiNote": true
  }'
```

## Notes

- Backend persistence is file-based for MVP speed and can be replaced with Postgres/Redis in production.
- Use `X-User-Id` request header for multi-user isolation in API-driven flows.
- The app is a simulator and idea dashboard, not a brokerage or order-routing system.
- Alpha Vantage quote freshness depends on your plan. The app will still work, but truly real-time feeds may require a premium entitlement.
