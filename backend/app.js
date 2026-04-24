import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const STORE_PATH = path.resolve(process.cwd(), "backend", "data", "store.json");
const quoteCache = new Map();

const AGENTS = [
  "Macro Agent",
  "Tape Agent",
  "Pattern Agent",
  "Risk Agent",
  "Behavior Agent",
  "Backtest Agent",
  "News Agent",
  "Confluence Agent",
  "Coach Agent",
  "Memory Agent",
];

const DEMO_SYMBOLS = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", sector: "Technology", price: 214.32, change: 3.18, changePercent: 1.51, volume: 58214001, marketCap: "3.2T", beta: "1.24", peRatio: "33.8" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", sector: "Technology", price: 428.54, change: -2.84, changePercent: -0.66, volume: 19284013, marketCap: "3.1T", beta: "0.91", peRatio: "36.1" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", sector: "Semiconductors", price: 942.41, change: 24.77, changePercent: 2.7, volume: 45178210, marketCap: "2.3T", beta: "1.72", peRatio: "62.4" },
  { symbol: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ", sector: "Automotive", price: 172.12, change: -4.91, changePercent: -2.77, volume: 93847121, marketCap: "548B", beta: "2.32", peRatio: "45.7" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", exchange: "NASDAQ", sector: "Consumer Cyclical", price: 184.74, change: 1.46, changePercent: 0.8, volume: 34412789, marketCap: "1.9T", beta: "1.18", peRatio: "59.4" },
  { symbol: "META", name: "Meta Platforms, Inc.", exchange: "NASDAQ", sector: "Communication Services", price: 503.89, change: 8.03, changePercent: 1.62, volume: 15437720, marketCap: "1.3T", beta: "1.21", peRatio: "28.9" },
];

const DEMO_SERIES = {
  AAPL: [191, 193, 194, 196, 198, 201, 205, 207, 206, 209, 212, 214],
  MSFT: [414, 416, 421, 423, 430, 434, 432, 431, 429, 430, 427, 428],
  NVDA: [801, 822, 840, 856, 873, 890, 908, 914, 926, 918, 932, 942],
  TSLA: [189, 188, 185, 183, 181, 180, 177, 179, 176, 174, 173, 172],
  AMZN: [171, 173, 174, 176, 177, 179, 181, 182, 180, 181, 183, 184],
  META: [462, 468, 474, 481, 489, 491, 488, 493, 497, 499, 501, 503],
};

function defaultStore() {
  return { users: {}, profiles: {}, watchlists: {}, paperOrders: [], drawings: [], memoryEvents: [], agentRuns: [], backtests: [] };
}

async function loadStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return { ...defaultStore(), ...JSON.parse(raw) };
  } catch {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    const initial = defaultStore();
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
}

async function saveStore(store) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-User-Id",
  });
  response.end(JSON.stringify(payload));
}

function getUserId(request) {
  const header = request.headers["x-user-id"];
  return String(header || "demo-user").trim();
}

function clampList(symbols, limit = 8) {
  return Array.from(new Set(symbols.filter(Boolean).map((symbol) => String(symbol).trim().toUpperCase()).filter((symbol) => /^[A-Z.\-]{1,10}$/.test(symbol)))).slice(0, limit);
}

function average(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function buildDemoHistory(symbol) {
  return (DEMO_SERIES[symbol] || []).map((close, index, all) => ({ date: `Day ${all.length - index}`, close }));
}

function getDemoSymbol(symbol) {
  return DEMO_SYMBOLS.find((item) => item.symbol === symbol);
}

function buildTradeIdea({ symbol, name, price, changePercent, history, sector }) {
  const closes = history.map((entry) => entry.close).filter(Number.isFinite);
  const latest = closes[0] ?? price;
  const sma5 = average(closes.slice(0, 5));
  const sma10 = average(closes.slice(0, 10));
  const weekAgo = closes[4] ?? latest;
  const swingPercent = weekAgo ? ((latest - weekAgo) / weekAgo) * 100 : 0;
  let stance = "Watch";
  let confidence = 58;
  let risk = "Medium";
  if (latest > sma5 && sma5 > sma10 && swingPercent > 2) {
    stance = "Buy bias";
    confidence = 76;
  } else if (latest < sma5 && sma5 < sma10 && swingPercent < -2) {
    stance = "Reduce risk";
    confidence = 79;
  }
  if (Math.abs(changePercent) > 2.5) risk = "High";
  return {
    symbol, name, sector, stance, confidence, risk,
    summary: `${symbol} is in a ${stance.toLowerCase()} setup near $${Number(price || 0).toFixed(2)}.`,
    reasons: [
      `5-session average: ${sma5.toFixed(2)}`,
      `10-session average: ${sma10.toFixed(2)}`,
      `5-session swing: ${swingPercent.toFixed(1)}%`,
    ],
    setup: stance === "Buy bias" ? "Look for pullbacks into structure." : stance === "Reduce risk" ? "Wait for trend repair before adding." : "Wait for clearer directional confirmation.",
  };
}

async function parseBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Market API failed: ${response.status}`);
  return response.json();
}

async function alphaVantageQuery(parameters) {
  const params = new URLSearchParams({ ...parameters, apikey: ALPHA_VANTAGE_API_KEY });
  const payload = await fetchJson(`https://www.alphavantage.co/query?${params.toString()}`);
  if (payload.Note || payload.Information || payload["Error Message"]) throw new Error(payload.Note || payload.Information || payload["Error Message"]);
  return payload;
}

async function getCached(key, ttlMs, loader) {
  const existing = quoteCache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value;
  const value = await loader();
  quoteCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

async function getHistory(symbol) {
  if (!ALPHA_VANTAGE_API_KEY) return buildDemoHistory(symbol);
  return getCached(`history:${symbol}`, 5 * 60_000, async () => {
    const payload = await alphaVantageQuery({ function: "TIME_SERIES_DAILY", symbol, outputsize: "compact" });
    const series = payload["Time Series (Daily)"];
    if (!series) throw new Error(`History not available for ${symbol}.`);
    return Object.entries(series).slice(0, 30).map(([date, values]) => ({ date, close: Number(values["4. close"] || 0) }));
  });
}

async function getOverview(symbol) {
  if (!ALPHA_VANTAGE_API_KEY) {
    const demo = getDemoSymbol(symbol);
    if (!demo) throw new Error(`Unknown symbol: ${symbol}`);
    return { name: demo.name, exchange: demo.exchange, sector: demo.sector, marketCap: demo.marketCap, beta: demo.beta, peRatio: demo.peRatio };
  }
  return getCached(`overview:${symbol}`, 30 * 60_000, async () => {
    const payload = await alphaVantageQuery({ function: "OVERVIEW", symbol });
    return { name: payload.Name || symbol, exchange: payload.Exchange || "US", sector: payload.Sector || "Unknown", marketCap: payload.MarketCapitalization || null, beta: payload.Beta || null, peRatio: payload.PERatio || null };
  });
}

async function fetchQuote(symbol) {
  if (!ALPHA_VANTAGE_API_KEY) {
    const demo = getDemoSymbol(symbol);
    if (!demo) throw new Error(`Unknown symbol: ${symbol}`);
    const history = buildDemoHistory(symbol);
    return { mode: "demo", ...demo, history, tip: buildTradeIdea({ ...demo, history }) };
  }
  const quote = await getCached(`quote:${symbol}`, 60_000, async () => {
    const payload = await alphaVantageQuery({ function: "GLOBAL_QUOTE", symbol });
    const data = payload["Global Quote"];
    if (!data?.["05. price"]) throw new Error(`Quote unavailable for ${symbol}`);
    return { symbol: data["01. symbol"] || symbol, price: Number(data["05. price"] || 0), change: Number(data["09. change"] || 0), changePercent: Number(String(data["10. change percent"] || "0").replace("%", "")), volume: Number(data["06. volume"] || 0) };
  });
  const history = await getHistory(symbol);
  const overview = await getOverview(symbol);
  return { mode: "live", ...quote, ...overview, history, tip: buildTradeIdea({ ...quote, ...overview, history }) };
}

function summarizeMarket(quotes) {
  const advancers = quotes.filter((quote) => quote.changePercent > 0).length;
  const decliners = quotes.filter((quote) => quote.changePercent < 0).length;
  const averageMove = average(quotes.map((quote) => quote.changePercent));
  return { advancers, decliners, averageMove: Number(averageMove.toFixed(2)), hottest: [...quotes].sort((a, b) => b.changePercent - a.changePercent)[0] || null };
}

function runBacktest({ symbol, history, strategy = "trend_follow", risk = "balanced", initialCapital = 10_000 }) {
  const ordered = [...history].reverse();
  let cash = initialCapital;
  let shares = 0;
  const trades = [];
  for (let i = 10; i < ordered.length; i += 1) {
    const window = ordered.slice(i - 10, i);
    const sma5 = average(window.slice(5).map((x) => x.close));
    const sma10 = average(window.map((x) => x.close));
    const price = ordered[i].close;
    if (sma5 > sma10 && shares === 0) {
      const qty = Math.floor((cash * (risk === "aggressive" ? 0.5 : 0.3)) / price);
      if (qty > 0) {
        cash -= qty * price;
        shares += qty;
        trades.push({ side: "buy", price, quantity: qty, date: ordered[i].date });
      }
    } else if (sma5 < sma10 && shares > 0) {
      cash += shares * price;
      trades.push({ side: "sell", price, quantity: shares, date: ordered[i].date });
      shares = 0;
    }
  }
  const finalPrice = ordered[ordered.length - 1]?.close || 0;
  const finalValue = cash + shares * finalPrice;
  const returnPercent = initialCapital ? ((finalValue - initialCapital) / initialCapital) * 100 : 0;
  return { strategy, symbol, risk, trades, metrics: { initialCapital, finalValue, netPnl: finalValue - initialCapital, returnPercent, tradeCount: trades.length } };
}

function buildPortfolio(orders, quotesBySymbol) {
  const positions = new Map();
  let realizedPnl = 0;
  [...orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach((order) => {
    const pos = positions.get(order.symbol) || { symbol: order.symbol, shares: 0, totalCost: 0, avgCost: 0 };
    if (order.side === "buy") {
      pos.totalCost += order.price * order.quantity;
      pos.shares += order.quantity;
      pos.avgCost = pos.shares ? pos.totalCost / pos.shares : 0;
    } else {
      const soldCost = pos.avgCost * order.quantity;
      pos.shares -= order.quantity;
      pos.totalCost -= soldCost;
      realizedPnl += order.price * order.quantity - soldCost;
      if (pos.shares <= 0) {
        pos.shares = 0;
        pos.totalCost = 0;
        pos.avgCost = 0;
      }
    }
    positions.set(order.symbol, pos);
  });
  const openPositions = Array.from(positions.values()).filter((x) => x.shares > 0).map((pos) => {
    const current = quotesBySymbol[pos.symbol]?.price || pos.avgCost;
    const marketValue = current * pos.shares;
    return { ...pos, currentPrice: current, marketValue, unrealizedPnl: marketValue - pos.totalCost };
  });
  return { positions: openPositions, realizedPnl, unrealizedPnl: openPositions.reduce((s, p) => s + p.unrealizedPnl, 0), marketValue: openPositions.reduce((s, p) => s + p.marketValue, 0) };
}

function drawingInsight(strokes = []) {
  const points = strokes.flatMap((stroke) => stroke.points || []);
  const clutter = strokes.length > 10 || points.length > 150;
  const score = Math.max(20, Math.min(95, 55 + strokes.length * 3 - (clutter ? 20 : 0)));
  return {
    score,
    verdict: clutter ? "Needs cleaner confluence structure" : "Confluence structure looks reviewable",
    note: clutter ? "Too many overlapping lines reduce signal quality." : "Structure has enough intent for pattern/risk critique.",
    flags: [
      clutter ? "Over-annotation detected" : "Structure density acceptable",
      points.length < 20 ? "Add clearer invalidation zones" : "Sufficient annotation depth",
    ],
  };
}

function coachSummary(profile, timeline, symbol) {
  if (!profile) return "Complete onboarding to personalize coaching.";
  const wins = timeline.filter((x) => x.type === "trade_closed" && x.pnl > 0).length;
  const losses = timeline.filter((x) => x.type === "trade_closed" && x.pnl < 0).length;
  const accuracy = wins + losses ? (wins / (wins + losses)) * 100 : 0;
  return {
    proficiency: profile.proficiency,
    style: profile.style,
    focus: accuracy >= 55 ? "Protect gains with stricter sizing." : "Increase selectivity and wait for stronger confluence.",
    text: `${profile.proficiency} ${profile.style} coaching is active for ${symbol}. Accuracy is ${accuracy.toFixed(0)}%, so the coach is emphasizing ${accuracy >= 55 ? "risk discipline" : "setup quality"}.`,
  };
}

function buildAgentResponse(prompt, quote, summary) {
  return AGENTS.map((agent, index) => ({
    id: `${Date.now()}-${index}`,
    agent,
    status: index < 4 ? "live" : index < 8 ? "syncing" : "learning",
    output: index === 0
      ? `${quote.symbol} macro regime appears ${Math.abs(quote.changePercent) > 1.8 ? "high-volatility" : "stable"}.`
      : index === 1
        ? `Tape movement today is ${quote.changePercent >= 0 ? "constructive" : "fading"} at ${quote.changePercent.toFixed(2)}%.`
        : index === 8
          ? summary.text
          : `Processed prompt segment: "${prompt.slice(0, 60)}${prompt.length > 60 ? "..." : ""}"`,
    confidence: Math.max(55, 90 - index * 2),
  }));
}

async function maybeGenerateAiNote(ideas) {
  if (!GEMINI_API_KEY || !ideas.length) return null;
  const prompt = `Create a concise trading watchlist brief from this JSON. No promises, max 4 bullets.\n${JSON.stringify(ideas)}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("").trim() || null;
}

async function searchSymbols(keywords) {
  const search = String(keywords || "").trim();
  if (!search) {
    return DEMO_SYMBOLS.slice(0, 6).map((item) => ({ symbol: item.symbol, name: item.name, exchange: item.exchange, currency: "USD", matchScore: 1 }));
  }
  if (!ALPHA_VANTAGE_API_KEY) {
    return DEMO_SYMBOLS.filter((item) => item.symbol.includes(search.toUpperCase()) || item.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8).map((item) => ({ symbol: item.symbol, name: item.name, exchange: item.exchange, currency: "USD", matchScore: 1 }));
  }
  return getCached(`search:${search}`, 60_000, async () => {
    const payload = await alphaVantageQuery({ function: "SYMBOL_SEARCH", keywords: search });
    return (payload.bestMatches || []).slice(0, 8).map((match) => ({ symbol: match["1. symbol"], name: match["2. name"], exchange: match["4. region"], currency: match["8. currency"], matchScore: Number(match["9. matchScore"] || 0) }));
  });
}

function stream(response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  response.write(`event: ready\ndata: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`);
  const timer = setInterval(() => {
    const symbols = DEMO_SYMBOLS.slice(0, 4).map((item) => ({
      symbol: item.symbol,
      price: Number((item.price + (Math.random() - 0.5) * 2).toFixed(2)),
      changePercent: Number((item.changePercent + (Math.random() - 0.5) * 0.4).toFixed(2)),
    }));
    response.write(`event: market\ndata: ${JSON.stringify({ type: "market_tick", symbols, ts: Date.now() })}\n\n`);
    response.write(`event: agents\ndata: ${JSON.stringify({ type: "agent_progress", active: AGENTS[Math.floor(Math.random() * AGENTS.length)], ts: Date.now() })}\n\n`);
  }, 4_000);
  response.on("close", () => clearInterval(timer));
}

export function createAppServer() {
  return http.createServer(async (request, response) => {
    if (!request.url) return json(response, 404, { error: "Not Found" });
    if (request.method === "OPTIONS") return json(response, 204, {});
    const userId = getUserId(request);
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const { pathname, searchParams } = url;
    const store = await loadStore();
    try {
      if (request.method === "GET" && pathname === "/api/health") {
        return json(response, 200, { ok: true, service: "goodtrades-api", mode: ALPHA_VANTAGE_API_KEY ? "live" : "demo", integrations: { alphaVantage: { configured: Boolean(ALPHA_VANTAGE_API_KEY) }, gemini: { configured: Boolean(GEMINI_API_KEY), model: GEMINI_MODEL } }, timestamp: new Date().toISOString() });
      }
      if (request.method === "GET" && pathname === "/api/stream/live") return stream(response);
      if (request.method === "POST" && pathname === "/api/onboarding/profile") {
        const body = await parseBody(request);
        store.profiles[userId] = { ...body, updatedAt: new Date().toISOString() };
        await saveStore(store);
        return json(response, 200, { ok: true, profile: store.profiles[userId] });
      }
      if (request.method === "GET" && pathname === "/api/market/search") {
        const results = await searchSymbols(searchParams.get("keywords"));
        return json(response, 200, { mode: ALPHA_VANTAGE_API_KEY ? "live" : "demo", results });
      }
      if (request.method === "GET" && pathname === "/api/market/watchlist") {
        const symbols = clampList((searchParams.get("symbols") || "AAPL,MSFT,NVDA,TSLA").split(","));
        const quotes = (await Promise.all(symbols.map(fetchQuote))).filter(Boolean);
        return json(response, 200, { mode: ALPHA_VANTAGE_API_KEY ? "live" : "demo", quotes, marketPulse: summarizeMarket(quotes), updatedAt: new Date().toISOString() });
      }
      if (request.method === "GET" && pathname === "/api/market/symbol") {
        const symbol = clampList([searchParams.get("symbol") || "AAPL"], 1)[0];
        if (!symbol) throw new Error("A valid stock symbol is required.");
        return json(response, 200, await fetchQuote(symbol));
      }
      if (request.method === "POST" && pathname === "/api/market/ideas") {
        const body = await parseBody(request);
        const symbols = clampList(Array.isArray(body.symbols) ? body.symbols : ["AAPL", "MSFT", "NVDA"]);
        const quotes = (await Promise.all(symbols.map(fetchQuote))).filter(Boolean);
        const ideas = quotes.map((quote) => quote.tip);
        const aiNote = body.includeAiNote ? await maybeGenerateAiNote(ideas) : null;
        return json(response, 200, { mode: ALPHA_VANTAGE_API_KEY ? "live" : "demo", ideas, aiNote });
      }
      if (request.method === "POST" && pathname === "/api/paper/orders") {
        const body = await parseBody(request);
        const symbol = clampList([body.symbol], 1)[0];
        const side = body.side === "sell" ? "sell" : "buy";
        const quantity = Number(body.quantity || 0);
        if (!symbol || quantity <= 0) throw new Error("Valid symbol and positive quantity are required.");
        const quote = await fetchQuote(symbol);
        const order = { id: crypto.randomUUID(), userId, symbol, side, quantity, price: Number(body.price || quote.price), createdAt: new Date().toISOString(), note: body.note || "" };
        store.paperOrders.push(order);
        store.memoryEvents.unshift({ id: crypto.randomUUID(), userId, type: "trade_event", symbol, side, quantity, price: order.price, createdAt: order.createdAt });
        await saveStore(store);
        return json(response, 200, { ok: true, order });
      }
      if (request.method === "GET" && pathname === "/api/paper/portfolio") {
        const userOrders = store.paperOrders.filter((order) => order.userId === userId);
        const symbols = clampList(userOrders.map((order) => order.symbol), 32);
        const quotes = await Promise.all(symbols.map(fetchQuote));
        const quoteMap = Object.fromEntries(quotes.map((quote) => [quote.symbol, quote]));
        return json(response, 200, { ok: true, ...buildPortfolio(userOrders, quoteMap), orders: userOrders.slice(-50).reverse() });
      }
      if (request.method === "POST" && pathname === "/api/backtest/run") {
        const body = await parseBody(request);
        const symbol = clampList([body.symbol || "AAPL"], 1)[0];
        const history = await getHistory(symbol);
        const result = runBacktest({ symbol, history, strategy: body.strategy || "trend_follow", risk: body.risk || "balanced", initialCapital: Number(body.initialCapital || 10_000) });
        const record = { id: crypto.randomUUID(), userId, createdAt: new Date().toISOString(), ...result };
        store.backtests.unshift(record);
        await saveStore(store);
        return json(response, 200, { ok: true, backtest: record });
      }
      if (request.method === "GET" && pathname === "/api/memory/timeline") {
        const events = store.memoryEvents.filter((event) => event.userId === userId).slice(0, 100);
        return json(response, 200, { ok: true, events });
      }
      if (request.method === "POST" && pathname === "/api/agents/query") {
        const body = await parseBody(request);
        const symbol = clampList([body.symbol || "AAPL"], 1)[0];
        const quote = await fetchQuote(symbol);
        const summary = coachSummary(store.profiles[userId], store.memoryEvents.filter((event) => event.userId === userId), symbol);
        const outputs = buildAgentResponse(String(body.prompt || "Provide actionable analysis"), quote, summary);
        const run = { id: crypto.randomUUID(), userId, symbol, prompt: body.prompt || "", createdAt: new Date().toISOString(), outputs };
        store.agentRuns.unshift(run);
        store.memoryEvents.unshift({ id: crypto.randomUUID(), userId, type: "agent_query", symbol, prompt: body.prompt || "", createdAt: run.createdAt });
        await saveStore(store);
        return json(response, 200, { ok: true, run });
      }
      if (request.method === "POST" && pathname === "/api/drawings/analyze") {
        const body = await parseBody(request);
        const symbol = clampList([body.symbol || "AAPL"], 1)[0];
        const insight = drawingInsight(Array.isArray(body.strokes) ? body.strokes : []);
        const record = { id: crypto.randomUUID(), userId, symbol, createdAt: new Date().toISOString(), strokes: Array.isArray(body.strokes) ? body.strokes : [], ...insight };
        store.drawings.unshift(record);
        store.memoryEvents.unshift({ id: crypto.randomUUID(), userId, type: "drawing_analysis", symbol, score: insight.score, createdAt: record.createdAt });
        await saveStore(store);
        return json(response, 200, { ok: true, analysis: record });
      }
      if (request.method === "GET" && pathname === "/api/coach/summary") {
        const symbol = clampList([searchParams.get("symbol") || "AAPL"], 1)[0];
        const summary = coachSummary(store.profiles[userId], store.memoryEvents.filter((event) => event.userId === userId), symbol);
        return json(response, 200, { ok: true, summary });
      }
      return json(response, 404, { error: "Not Found", message: "Endpoint does not exist." });
    } catch (error) {
      return json(response, error.message === "Payload too large" ? 413 : 400, { error: "Request Failed", message: error.message });
    }
  });
}
