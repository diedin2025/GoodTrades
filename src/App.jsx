import { useEffect, useMemo, useRef, useState } from "react";
import { AgentConstellationForeground } from "./components/AgentConstellation";

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA"];
const STORAGE_KEYS = {
  watchlist: "quant-pilot-watchlist",
  trades: "quant-pilot-trades",
  profile: "quant-pilot-profile",
  drawings: "quant-pilot-drawing-insights",
};

const AGENTS = [
  { name: "Macro Agent", purpose: "Rates, CPI, and sector pressure mapping" },
  { name: "Tape Agent", purpose: "Momentum and intraday expansion checks" },
  { name: "Pattern Agent", purpose: "Chart structure and breakout validation" },
  { name: "Risk Agent", purpose: "Sizing, stop logic, and drawdown control" },
  { name: "Behavior Agent", purpose: "Tracks emotional execution mistakes" },
  { name: "Backtest Agent", purpose: "Replays setups against prior conditions" },
  { name: "News Agent", purpose: "Catalyst and headline sensitivity scoring" },
  { name: "Confluence Agent", purpose: "Confirms or questions overlapping signals" },
  { name: "Coach Agent", purpose: "Adapts explanations to your proficiency" },
  { name: "Memory Agent", purpose: "Remembers every trade, note, and pattern" },
];

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : 4,
  }).format(Number(value || 0));
}

function percent(value) {
  const numeric = Number(value || 0);
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(2)}%`;
}

function signedMoney(value) {
  const numeric = Number(value || 0);
  return `${numeric > 0 ? "+" : ""}${currency(numeric)}`;
}

function compactNumber(value) {
  const numeric = Number(value || 0);

  if (numeric >= 1_000_000_000) {
    return `${(numeric / 1_000_000_000).toFixed(1)}B`;
  }

  if (numeric >= 1_000_000) {
    return `${(numeric / 1_000_000).toFixed(1)}M`;
  }

  if (numeric >= 1_000) {
    return `${(numeric / 1_000).toFixed(1)}K`;
  }

  return String(numeric);
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculatePortfolio(trades, quotesBySymbol) {
  const positions = new Map();
  let realizedPnl = 0;

  [...trades]
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .forEach((trade) => {
      const current = positions.get(trade.symbol) || {
        symbol: trade.symbol,
        name: trade.name,
        shares: 0,
        averageCost: 0,
        totalCost: 0,
      };

      if (trade.side === "buy") {
        current.totalCost += trade.price * trade.quantity;
        current.shares += trade.quantity;
        current.averageCost = current.shares ? current.totalCost / current.shares : 0;
      } else {
        const soldCost = current.averageCost * trade.quantity;
        current.shares -= trade.quantity;
        current.totalCost -= soldCost;
        realizedPnl += trade.price * trade.quantity - soldCost;

        if (current.shares <= 0) {
          current.shares = 0;
          current.averageCost = 0;
          current.totalCost = 0;
        }
      }

      positions.set(trade.symbol, current);
    });

  const list = Array.from(positions.values())
    .filter((position) => position.shares > 0)
    .map((position) => {
      const currentPrice = quotesBySymbol[position.symbol]?.price || position.averageCost;
      const marketValue = currentPrice * position.shares;
      const unrealizedPnl = marketValue - position.totalCost;

      return {
        ...position,
        currentPrice,
        marketValue,
        unrealizedPnl,
      };
    });

  return {
    positions: list,
    realizedPnl,
    marketValue: list.reduce((sum, item) => sum + item.marketValue, 0),
    invested: list.reduce((sum, item) => sum + item.totalCost, 0),
    unrealizedPnl: list.reduce((sum, item) => sum + item.unrealizedPnl, 0),
  };
}

function analyzeLedger(trades, quotesBySymbol) {
  const ordered = [...trades].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
  const buyLots = new Map();
  const closed = [];

  ordered.forEach((trade) => {
    const symbolLots = buyLots.get(trade.symbol) || [];

    if (trade.side === "buy") {
      symbolLots.push({
        quantity: trade.quantity,
        price: trade.price,
        createdAt: trade.createdAt,
      });
      buyLots.set(trade.symbol, symbolLots);
      return;
    }

    let remaining = trade.quantity;

    while (remaining > 0 && symbolLots.length) {
      const lot = symbolLots[0];
      const matchedQuantity = Math.min(remaining, lot.quantity);
      const pnl = (trade.price - lot.price) * matchedQuantity;
      const returnPercent = lot.price ? ((trade.price - lot.price) / lot.price) * 100 : 0;

      closed.push({
        id: `${trade.id}-${lot.createdAt}-${matchedQuantity}`,
        symbol: trade.symbol,
        quantity: matchedQuantity,
        entryPrice: lot.price,
        exitPrice: trade.price,
        entryAt: lot.createdAt,
        exitAt: trade.createdAt,
        pnl,
        returnPercent,
        verdict:
          returnPercent >= 2
            ? "Disciplined winner"
            : returnPercent <= -2
              ? "Cut or review faster"
              : "Neutral execution",
      });

      lot.quantity -= matchedQuantity;
      remaining -= matchedQuantity;

      if (lot.quantity <= 0) {
        symbolLots.shift();
      }
    }
  });

  const markedOpen = Array.from(buyLots.entries()).flatMap(([symbol, lots]) =>
    lots.map((lot) => {
      const currentPrice = quotesBySymbol[symbol]?.price || lot.price;
      const pnl = (currentPrice - lot.price) * lot.quantity;
      return {
        symbol,
        quantity: lot.quantity,
        entryPrice: lot.price,
        currentPrice,
        pnl,
      };
    })
  );

  const wins = closed.filter((trade) => trade.pnl > 0).length;
  const losses = closed.filter((trade) => trade.pnl < 0).length;
  const accuracy = closed.length ? (wins / closed.length) * 100 : 0;
  const avgClosedReturn = closed.length ? average(closed.map((trade) => trade.returnPercent)) : 0;
  const avgOpenPnl = markedOpen.length ? average(markedOpen.map((trade) => trade.pnl)) : 0;

  const bySymbol = closed.reduce((map, trade) => {
    const entry = map.get(trade.symbol) || { trades: 0, pnl: 0 };
    entry.trades += 1;
    entry.pnl += trade.pnl;
    map.set(trade.symbol, entry);
    return map;
  }, new Map());

  const strongestSymbol = [...bySymbol.entries()].sort((left, right) => right[1].pnl - left[1].pnl)[0]?.[0] || "None yet";

  return {
    closed,
    wins,
    losses,
    accuracy,
    avgClosedReturn,
    avgOpenPnl,
    strongestSymbol,
  };
}

function trendPath(values) {
  if (!values.length) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / spread) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

function Sparkline({ values, positive = true }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="sparkline" aria-hidden="true">
      <polyline points={trendPath(values)} className={positive ? "sparkline-up" : "sparkline-down"} />
    </svg>
  );
}

function MetricCard({ label, value, note, tone = "neutral" }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function ScreenButton({ active, onClick, children }) {
  return (
    <button type="button" className={`screen-button btn-ui ${active ? "active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function WatchlistRow({ quote, active, onSelect }) {
  const historyValues = (quote.history || []).map((entry) => entry.close).reverse();
  const positive = (quote.changePercent || 0) >= 0;

  return (
    <button type="button" className={`watch-row ${active ? "active" : ""}`} onClick={() => onSelect(quote.symbol)}>
      <div>
        <strong>{quote.symbol}</strong>
        <span>{quote.name}</span>
      </div>
      <div className="watch-price">
        <strong>{currency(quote.price)}</strong>
        <span className={positive ? "positive" : "negative"}>{percent(quote.changePercent)}</span>
      </div>
      <div className="watch-spark">
        <Sparkline values={historyValues} positive={positive} />
      </div>
    </button>
  );
}

function buildCoachSummary(profile, memory, selectedQuote) {
  if (!profile) {
    return "Set your profile to unlock adaptive coaching.";
  }

  const proficiencyTone =
    profile.proficiency === "Beginner"
      ? "The coach is keeping language simple, reinforcing risk basics, and highlighting only the clearest setups."
      : profile.proficiency === "Intermediate"
        ? "The coach is balancing structure with speed, pushing you toward repeatable rules instead of reactive trades."
        : "The coach assumes you can execute and is focusing on edge refinement, drawdown control, and cleaner filters.";

  const performanceTone =
    memory.closed.length === 0
      ? "No closed trades yet, so the system is learning from your preferences first."
      : memory.accuracy >= 60
        ? `Closed-trade accuracy is ${memory.accuracy.toFixed(0)}%, so it is encouraging more size discipline than idea changes.`
        : `Closed-trade accuracy is ${memory.accuracy.toFixed(0)}%, so it is recommending fewer trades and stronger confluence before entry.`;

  const symbolTone = selectedQuote
    ? `${selectedQuote.symbol} is the active study symbol, and the coach is framing feedback around ${profile.style.toLowerCase()} execution.`
    : "Pick a symbol to get symbol-specific coaching.";

  return `${proficiencyTone} ${performanceTone} ${symbolTone}`;
}

function analyzeDrawing(strokes) {
  if (!strokes.length) {
    return {
      score: 18,
      verdict: "No chart markup yet",
      note: "Draw trend lines, support zones, or channels and the AI agents will review the structure.",
      flags: ["Waiting for structure"],
    };
  }

  const segments = strokes.flatMap((stroke) => stroke.points);
  const averageStrokeSize = average(strokes.map((stroke) => stroke.points.length));
  const clutter = strokes.length > 9 || averageStrokeSize < 7;
  const broadStructure = strokes.some((stroke) => stroke.points.length > 18);
  const tightMicroLines = strokes.filter((stroke) => stroke.points.length < 6).length >= 4;
  const score = Math.max(24, Math.min(93, 48 + strokes.length * 4 + (broadStructure ? 12 : 0) - (clutter ? 16 : 0)));

  const flags = [];

  if (clutter) {
    flags.push("Questionable confluence from too many overlapping lines");
  }

  if (tightMicroLines) {
    flags.push("Several tiny marks may be reacting to noise rather than structure");
  }

  if (broadStructure) {
    flags.push("At least one larger structure suggests real intent behind the setup");
  }

  if (segments.length > 90) {
    flags.push("High annotation density could hide the clean invalidation level");
  }

  return {
    score,
    verdict: clutter ? "Needs cleaner structure" : "Confluence looks usable",
    note: clutter
      ? "The AI would ask you to remove weaker lines and keep only the levels that meaningfully change the trade plan."
      : "Your markup has enough structure for the agents to compare trend, risk, and confluence logic.",
    flags,
  };
}

function buildAgentReadout(selectedQuote, memory, drawingInsight, profile) {
  const symbol = selectedQuote?.symbol || "Watchlist";
  const move = selectedQuote?.changePercent || 0;
  const openTone = memory.avgOpenPnl >= 0 ? "holding gains" : "holding pressure";
  const experience = profile?.proficiency || "Adaptive";

  return AGENTS.map((agent, index) => ({
    ...agent,
    status: index < 3 ? "Live" : index < 7 ? "Syncing" : "Learning",
    output:
      index === 0
        ? `${symbol} macro pressure is ${Math.abs(move) > 1.5 ? "elevated" : "contained"} today.`
        : index === 1
          ? `Tape momentum is ${move >= 0 ? "supportive" : "fading"} with ${percent(move)} session movement.`
          : index === 2
            ? drawingInsight.verdict
            : index === 3
              ? `Risk model sees ${openTone} and suggests tighter invalidation.`
              : index === 4
                ? `${memory.losses > memory.wins ? "Revenge-trade risk is elevated." : "Behavior looks controlled so far."}`
                : index === 5
                  ? `Backtest memory favors ${memory.strongestSymbol} based on closed results.`
                  : index === 6
                    ? "Catalyst sensitivity is available through the live market feed layer."
                    : index === 7
                      ? `${drawingInsight.flags[0] || "Signals are relatively aligned right now."}`
                      : index === 8
                        ? `Coach mode is tuned for ${experience.toLowerCase()} execution.`
                        : `${memory.closed.length + memory.losses + memory.wins} memory objects indexed for reuse.`,
  }));
}

export default function App() {
  const [watchlist, setWatchlist] = useState(() => readStorage(STORAGE_KEYS.watchlist, DEFAULT_WATCHLIST));
  const [trades, setTrades] = useState(() => readStorage(STORAGE_KEYS.trades, []));
  const [profile, setProfile] = useState(() => readStorage(STORAGE_KEYS.profile, null));
  const [drawingHistory, setDrawingHistory] = useState(() => readStorage(STORAGE_KEYS.drawings, []));
  const [market, setMarket] = useState({ quotes: [], marketPulse: null, mode: "demo" });
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_WATCHLIST[0]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [tradeSide, setTradeSide] = useState("buy");
  const [quantity, setQuantity] = useState("5");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [aiNote, setAiNote] = useState("");
  const [apiHealth, setApiHealth] = useState(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [uploadTargetIndex, setUploadTargetIndex] = useState(-1);
  const [uploadToken, setUploadToken] = useState(0);
  const [promptMessages, setPromptMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "Prompt routing is ready. Ask for a market brief, a setup review, a risk summary, or a teaching-style explanation.",
    },
  ]);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [draftProfile, setDraftProfile] = useState(
    () =>
      profile || {
        name: "",
        proficiency: "Intermediate",
        goal: "Grow a repeatable swing-trading system",
        risk: "Balanced",
        style: "Swing trading",
        learning: "Direct coaching",
      }
  );
  const [activeScreen, setActiveScreen] = useState(0);
  const [strokes, setStrokes] = useState([]);
  const [drawingInsight, setDrawingInsight] = useState(() => analyzeDrawing([]));
  const [drawingSession, setDrawingSession] = useState(null);

  const canvasRef = useRef(null);
  const drawingRef = useRef({ active: false, currentStroke: [] });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.trades, JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.drawings, JSON.stringify(drawingHistory));
  }, [drawingHistory]);

  useEffect(() => {
    if (profile) {
      window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
    }
  }, [profile]);

  useEffect(() => {
    if (!watchlist.includes(selectedSymbol)) {
      setSelectedSymbol(watchlist[0] || "AAPL");
    }
  }, [selectedSymbol, watchlist]);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health");

        if (!response.ok) {
          throw new Error("Could not load integration health.");
        }

        const payload = await response.json();

        if (!cancelled) {
          setApiHealth(payload);
        }
      } catch {
        if (!cancelled) {
          setApiHealth(null);
        }
      }
    }

    loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWatchlist() {
      setStatus((current) => ({ ...current, loading: true, error: "" }));

      try {
        const response = await fetch(`/api/market/watchlist?symbols=${watchlist.join(",")}`);

        if (!response.ok) {
          throw new Error("Could not load watchlist data.");
        }

        const payload = await response.json();

        if (!cancelled) {
          setMarket(payload);
          setIdeas(payload.quotes.map((quote) => quote.tip));
          setStatus({ loading: false, error: "" });
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({ loading: false, error: error.message });
        }
      }
    }

    loadWatchlist();
    const intervalId = window.setInterval(loadWatchlist, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [watchlist]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedStock() {
      if (!selectedSymbol) {
        return;
      }

      try {
        const response = await fetch(`/api/market/symbol?symbol=${selectedSymbol}`);

        if (!response.ok) {
          throw new Error("Could not load symbol detail.");
        }

        const payload = await response.json();

        if (!cancelled) {
          setSelectedStock(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus((current) => ({ ...current, error: error.message }));
        }
      }
    }

    loadSelectedStock();

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/market/search?keywords=${encodeURIComponent(searchTerm)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Search is unavailable.");
        }

        const payload = await response.json();
        setSearchResults(payload.results || []);
      } catch (error) {
        if (error.name !== "AbortError") {
          setStatus((current) => ({ ...current, error: error.message }));
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    canvas.width = bounds.width * ratio;
    canvas.height = bounds.height * ratio;

    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#f8f6ef";
    context.lineWidth = 2;

    strokes.forEach((stroke) => {
      if (!stroke.points.length) {
        return;
      }

      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);

      stroke.points.slice(1).forEach((point) => {
        context.lineTo(point.x, point.y);
      });

      context.stroke();
    });
  }, [strokes]);

  const quotesBySymbol = useMemo(
    () =>
      Object.fromEntries(
        market.quotes.map((quote) => [
          quote.symbol,
          {
            ...quote,
            ...(selectedStock?.symbol === quote.symbol ? selectedStock : {}),
          },
        ])
      ),
    [market.quotes, selectedStock]
  );

  const portfolio = useMemo(() => calculatePortfolio(trades, quotesBySymbol), [trades, quotesBySymbol]);
  const memory = useMemo(() => analyzeLedger(trades, quotesBySymbol), [trades, quotesBySymbol]);
  const selectedQuote = quotesBySymbol[selectedSymbol] || selectedStock;
  const selectedPosition = portfolio.positions.find((position) => position.symbol === selectedSymbol);
  const selectedHistory = (selectedQuote?.history || []).map((entry) => entry.close).reverse();
  const canSell = (selectedPosition?.shares || 0) >= Number(quantity || 0);
  const coachingSummary = buildCoachSummary(profile, memory, selectedQuote);
  const agentReadout = buildAgentReadout(selectedQuote, memory, drawingInsight, profile);
  const alphaConfigured = Boolean(apiHealth?.integrations?.alphaVantage?.configured);
  const geminiConfigured = Boolean(apiHealth?.integrations?.gemini?.configured);

  async function refreshIdeas(includeAiNote = false) {
    const response = await fetch("/api/market/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbols: watchlist,
        includeAiNote,
      }),
    });

    if (!response.ok) {
      throw new Error("Could not refresh trade ideas.");
    }

    const payload = await response.json();
    setIdeas(payload.ideas || []);
    setAiNote(payload.aiNote || "");
    return payload;
  }

  function goToScreen(index) {
    setActiveScreen(index);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function submitPrompt(event) {
    event.preventDefault();

    const nextPrompt = promptDraft.trim();

    if (!nextPrompt) {
      return;
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: nextPrompt,
    };

    setPromptMessages((current) => [...current, userMessage]);
    setPromptDraft("");
    const nextTarget = Math.floor(Math.random() * AGENTS.length);
    setUploadTargetIndex(nextTarget);
    setUploadToken((current) => current + 1);
    window.setTimeout(() => {
      setUploadTargetIndex(-1);
    }, 2200);

    let assistantText = `Routing your request through ${selectedSymbol}, the memory layer, and the configured integrations.`;

    try {
      const payload = await refreshIdeas(geminiConfigured);
      const selectedIdea = payload?.ideas?.find((idea) => idea.symbol === selectedSymbol) || payload?.ideas?.[0];

      if (geminiConfigured && payload?.aiNote) {
        assistantText = payload.aiNote;
      } else if (selectedIdea) {
        assistantText = `${selectedIdea.summary} ${selectedIdea.setup}`;
      } else if (alphaConfigured) {
        assistantText = `${selectedSymbol} market context refreshed through Alpha Vantage.`;
      }
    } catch {
      assistantText = "The prompt layer is available, but the live request could not complete right now.";
    }

    setPromptMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: assistantText,
      },
    ]);
  }

  function saveProfile(event) {
    event.preventDefault();
    setProfile(draftProfile);
  }

  function addToWatchlist(symbol) {
    setWatchlist((current) => (current.includes(symbol) ? current : [...current, symbol].slice(0, 8)));
    setSelectedSymbol(symbol);
    setSearchTerm("");
    setSearchResults([]);
  }

  function removeFromWatchlist(symbol) {
    setWatchlist((current) => current.filter((entry) => entry !== symbol));
  }

  function placeTrade(event) {
    event.preventDefault();

    if (!selectedQuote) {
      return;
    }

    const tradeQuantity = Number(quantity);

    if (!tradeQuantity || tradeQuantity <= 0) {
      setStatus((current) => ({ ...current, error: "Quantity must be greater than zero." }));
      return;
    }

    if (tradeSide === "sell" && !canSell) {
      setStatus((current) => ({ ...current, error: "You cannot sell more shares than you own." }));
      return;
    }

    const nextTrade = {
      id: crypto.randomUUID(),
      symbol: selectedQuote.symbol,
      name: selectedQuote.name,
      side: tradeSide,
      quantity: tradeQuantity,
      price: selectedQuote.price,
      createdAt: new Date().toISOString(),
    };

    setTrades((current) => [nextTrade, ...current]);
    setStatus((current) => ({ ...current, error: "" }));
  }

  function pointerPosition(event) {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  function startStroke(event) {
    event.preventDefault();
    drawingRef.current.active = true;
    drawingRef.current.currentStroke = [pointerPosition(event)];
  }

  function moveStroke(event) {
    if (!drawingRef.current.active) {
      return;
    }

    drawingRef.current.currentStroke.push(pointerPosition(event));
    const preview = drawingRef.current.currentStroke;
    setDrawingSession({ points: preview });
  }

  function endStroke() {
    if (!drawingRef.current.active) {
      return;
    }

    drawingRef.current.active = false;

    if (drawingRef.current.currentStroke.length) {
      setStrokes((current) => [...current, { id: crypto.randomUUID(), points: drawingRef.current.currentStroke }]);
    }

    drawingRef.current.currentStroke = [];
    setDrawingSession(null);
  }

  function clearDrawing() {
    setStrokes([]);
    setDrawingInsight(analyzeDrawing([]));
  }

  function runDrawingAnalysis() {
    const insight = analyzeDrawing(strokes);
    const record = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      symbol: selectedSymbol,
      ...insight,
    };

    setDrawingInsight(insight);
    setDrawingHistory((current) => [record, ...current].slice(0, 8));
  }

  const displayStrokes = drawingSession ? [...strokes, drawingSession] : strokes;

  useEffect(() => {
    if (!drawingSession) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    canvas.width = bounds.width * ratio;
    canvas.height = bounds.height * ratio;

    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#f8f6ef";
    context.lineWidth = 2;

    displayStrokes.forEach((stroke) => {
      if (!stroke.points.length) {
        return;
      }

      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    });
  }, [displayStrokes, drawingSession]);

  return (
    <main className="app-shell bg-bg text-ink">
      <section className="topbar layout-shell">
        <div>
          <p className="eyebrow">Business / eCom Trading Concept</p>
          <h1>GoodTrades</h1>
        </div>

        <div className="challenge-card surface-panel">
          <span className="pill">Medo Challenge Hook</span>
          <strong>Immersive AI x finance x explainability</strong>
          <p>Framed as a premium product experience with visible agent collaboration, adaptive learning, and conversion-ready storytelling.</p>
        </div>
      </section>

      {status.error ? <div className="banner error">{status.error}</div> : null}
      {market.mode === "demo" ? (
        <div className="banner">
          Demo mode is active. Add `ALPHA_VANTAGE_API_KEY` in the backend runtime env for live quotes.
        </div>
      ) : null}

      {activeScreen === 1 ? (
        <section className="overview-grid layout-shell">
          <MetricCard
            label="Trade Memory"
            value={String(trades.length)}
            note="Every simulated buy, sell, and drawing review is remembered across refreshes."
          />
          <MetricCard
            label="Closed Accuracy"
            value={`${memory.accuracy.toFixed(0)}%`}
            note="Win rate from fully closed paper trades."
            tone={memory.accuracy >= 50 ? "positive" : "negative"}
          />
          <MetricCard
            label="Portfolio Drift"
            value={signedMoney(portfolio.unrealizedPnl)}
            note="How open positions are behaving right now."
            tone={portfolio.unrealizedPnl >= 0 ? "positive" : "negative"}
          />
          <MetricCard
            label="Optimizer Bias"
            value={memory.strongestSymbol}
            note="Symbol currently favored by your historical results."
            tone="neutral"
          />
        </section>
      ) : null}

      <section className="screen-nav layout-shell">
        <ScreenButton active={activeScreen === 0} onClick={() => goToScreen(0)}>
          AI Prompt Menu
        </ScreenButton>
        <ScreenButton active={activeScreen === 1} onClick={() => goToScreen(1)}>
          Trading
        </ScreenButton>
      </section>

      <section className="screen-shell layout-shell">
        {activeScreen === 0 ? (
        <article className="screen-page active-screen">
          <div className="ai-chat-screen">
            <section className="ai-chat-shell surface-panel">
              <div className="ai-chat-visual" aria-hidden="true">
                <AgentConstellationForeground
                  agents={AGENTS}
                  selectedSymbol={selectedSymbol}
                  targetIndex={uploadTargetIndex}
                  uploadToken={uploadToken}
                />
              </div>
              <header className="ai-chat-header">
                <p className="eyebrow">AI Prompt Menu</p>
                <h2>What would you like the agents to do?</h2>
                <p className="body-copy">
                  Ask for a market brief, a trade critique, a teaching-style explanation, or a confluence review for {selectedSymbol}.
                </p>
              </header>

              <div className="ai-quick-actions">
                <button type="button" className="ghost-button btn-ghost" onClick={() => setPromptDraft(`Give me a market brief for ${selectedSymbol}.`)}>
                  Market brief
                </button>
                <button type="button" className="ghost-button btn-ghost" onClick={() => setPromptDraft(`Review the current ${selectedSymbol} setup and risk.`)}>
                  Setup review
                </button>
                <button type="button" className="ghost-button btn-ghost" onClick={() => setPromptDraft(`Teach me this trade like a ${profile?.proficiency || "beginner"}.`)}>
                  Teach me
                </button>
                <button type="button" className="ghost-button btn-ghost" onClick={() => setPromptDraft(`Summarize what my trading memory says about ${selectedSymbol}.`)}>
                  Memory summary
                </button>
              </div>

              <div className="ai-chat-thread">
                <article className="chat-message assistant">
                  <div className="chat-badge">System</div>
                  <p>
                    Integrations available:
                    {` Alpha Vantage ${alphaConfigured ? "connected" : "not configured"}, Gemini ${geminiConfigured ? "connected" : "not configured"}.`}
                  </p>
                </article>

                {promptMessages.map((message) => (
                  <article key={message.id} className={`chat-message ${message.role}`}>
                    <div className="chat-badge">{message.role === "assistant" ? "AI" : "You"}</div>
                    <p>{message.text}</p>
                  </article>
                ))}
              </div>

              <form className="ai-compose" onSubmit={submitPrompt}>
                <textarea
                  className="field-ui"
                  value={promptDraft}
                  onChange={(event) => setPromptDraft(event.target.value)}
                  placeholder="Message the AI prompt menu..."
                  rows={3}
                />
                <div className="ai-compose-footer">
                  <span className="subtle">
                    {alphaConfigured && geminiConfigured
                      ? "Full stack ready"
                      : alphaConfigured || geminiConfigured
                        ? "Partial stack ready"
                        : "Demo prompt mode"}
                  </span>
                  <button className="primary-button btn-primary" type="submit">
                    Send
                  </button>
                </div>
              </form>
            </section>
          </div>
        </article>
        ) : null}

        {activeScreen === 1 ? (
        <article className="screen-page active-screen">
          <div className="screen-grid market-grid">
            <div className="market-left-rail">
              <section className="panel watchlist-panel surface-panel">
                <div className="panel-head panel-heading">
                  <div>
                    <p className="eyebrow">Watchlist Builder</p>
                    <h2>Track the trade you want to study</h2>
                  </div>
                  <span className="subtle">{status.loading ? "Refreshing..." : "Auto-refreshing market feed"}</span>
                </div>

                <input
                  className="search-input field-ui"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search AAPL, Microsoft, NVDA..."
                />

                <div className="search-results">
                  {searchResults.map((result) => (
                    <button key={result.symbol} type="button" className="search-item surface-card" onClick={() => addToWatchlist(result.symbol)}>
                      <div>
                        <strong>{result.symbol}</strong>
                        <span>{result.name}</span>
                      </div>
                      <span>Add</span>
                    </button>
                  ))}
                </div>

                <div className="watchlist">
                  {market.quotes.map((quote) => (
                    <div key={quote.symbol} className="watch-row-wrap">
                      <WatchlistRow quote={quote} active={selectedSymbol === quote.symbol} onSelect={setSelectedSymbol} />
                      <button type="button" className="remove-button btn-ghost" onClick={() => removeFromWatchlist(quote.symbol)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="market-center-stage">
              <section className="panel stock-panel surface-panel">
                <div className="panel-head panel-heading">
                  <div>
                    <p className="eyebrow">Stock Screen</p>
                    <h2>{selectedQuote ? `${selectedQuote.symbol} market context` : "Choose a symbol"}</h2>
                  </div>
                  {selectedQuote ? (
                    <div className="headline-price">
                      <strong>{currency(selectedQuote.price)}</strong>
                      <span className={selectedQuote.changePercent >= 0 ? "positive" : "negative"}>
                        {percent(selectedQuote.changePercent)}
                      </span>
                    </div>
                  ) : null}
                </div>

                {selectedQuote ? (
                  <>
                    <div className="mini-grid studio-stats">
                      <MetricCard label="Company" value={selectedQuote.name} note={selectedQuote.exchange || "US"} />
                      <MetricCard label="Sector" value={selectedQuote.sector || "Unknown"} note="Used by the agent swarm." />
                      <MetricCard label="Volume" value={compactNumber(selectedQuote.volume)} note="Latest tracked share volume." />
                      <MetricCard
                        label="Market Cap"
                        value={selectedQuote.marketCap || "--"}
                        note={`Beta ${selectedQuote.beta || "--"} • P/E ${selectedQuote.peRatio || "--"}`}
                      />
                    </div>

                    <div className="chart-card feature-chart surface-card">
                      <div className="chart-head">
                        <h3>30-session trend</h3>
                        <span>{selectedHistory.length} closes</span>
                      </div>
                      <Sparkline values={selectedHistory} positive={(selectedQuote.changePercent || 0) >= 0} />
                    </div>

                    <article className="idea-card surface-card">
                      <div className="idea-top">
                        <div>
                          <p className="eyebrow">AI Trade Read</p>
                          <h3>{selectedQuote.tip?.stance || "Watch"}</h3>
                        </div>
                        <div className="tag-row">
                          <span>{selectedQuote.tip?.confidence || 0}% confidence</span>
                          <span>{selectedQuote.tip?.risk || "Medium"} risk</span>
                        </div>
                      </div>
                      <p className="body-copy">{selectedQuote.tip?.summary}</p>
                      <div className="tag-row">
                        {(selectedQuote.tip?.reasons || []).map((reason) => (
                          <span key={reason}>{reason}</span>
                        ))}
                      </div>
                      <p className="subtle">{selectedQuote.tip?.setup}</p>
                    </article>
                  </>
                ) : null}
              </section>

              <section className="panel drawing-panel surface-panel">
                <div className="panel-head panel-heading">
                  <div>
                    <p className="eyebrow">Drawing Screen</p>
                    <h2>Markup like TradingView, then let the AI question it</h2>
                  </div>
                  <div className="inline-actions">
                    <button type="button" className="ghost-button btn-ghost" onClick={runDrawingAnalysis}>
                      Analyze drawing
                    </button>
                    <button type="button" className="ghost-button btn-ghost" onClick={clearDrawing}>
                      Clear
                    </button>
                  </div>
                </div>

                <div
                  className="drawing-board"
                  onPointerDown={startStroke}
                  onPointerMove={moveStroke}
                  onPointerUp={endStroke}
                  onPointerLeave={endStroke}
                >
                  <canvas ref={canvasRef} className="drawing-canvas" />
                </div>

                <div className="drawing-feedback">
                  <MetricCard label="Confluence Score" value={`${drawingInsight.score}/100`} note={drawingInsight.verdict} />
                  <div className="feedback-copy">
                    <p>{drawingInsight.note}</p>
                    <div className="tag-row">
                      {drawingInsight.flags.map((flag) => (
                        <span key={flag}>{flag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="market-right-stack">
              <section className="panel trade-panel surface-panel">
                <div className="panel-head panel-heading">
                  <div>
                    <p className="eyebrow">Execution</p>
                    <h2>Simulate and remember every trade</h2>
                  </div>
                </div>

                <form className="trade-form" onSubmit={placeTrade}>
                  <div className="segmented">
                    <button type="button" className={tradeSide === "buy" ? "active buy" : ""} onClick={() => setTradeSide("buy")}>
                      Buy
                    </button>
                    <button type="button" className={tradeSide === "sell" ? "active sell" : ""} onClick={() => setTradeSide("sell")}>
                      Sell
                    </button>
                  </div>

                  <label>
                    Symbol
                    <input value={selectedSymbol} onChange={(event) => setSelectedSymbol(event.target.value.toUpperCase())} />
                  </label>

                  <label>
                    Quantity
                    <input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" />
                  </label>

                  <div className="ticket-preview">
                    <span>Estimated value</span>
                    <strong>{currency((selectedQuote?.price || 0) * Number(quantity || 0))}</strong>
                  </div>

                  {tradeSide === "sell" ? (
                    <div className="holding-note">Shares available to sell: {selectedPosition?.shares || 0}</div>
                  ) : (
                    <div className="holding-note">Unlimited practice capital is enabled for the backtesting prototype.</div>
                  )}

                  <button className="primary-button btn-primary" type="submit" disabled={!selectedQuote}>
                    Save trade to memory
                  </button>
                </form>

                <div className="activity-list compact">
                  {trades.slice(0, 6).map((trade) => (
                    <article key={trade.id} className="activity-item">
                      <div>
                        <strong>{trade.symbol}</strong>
                        <span>
                          {trade.side.toUpperCase()} {trade.quantity} shares
                        </span>
                      </div>
                      <div>
                        <strong>{currency(trade.price)}</strong>
                        <span>{new Date(trade.createdAt).toLocaleString()}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel insight-panel surface-panel">
                <div className="panel-head panel-heading">
                  <div>
                    <p className="eyebrow">Memory Timeline</p>
                    <h2>Recent AI observations</h2>
                  </div>
                </div>

                {aiNote ? <div className="ai-note">{aiNote}</div> : null}

                <div className="idea-list">
                  {ideas.slice(0, 4).map((idea) => (
                    <article key={idea.symbol} className="idea-list-card">
                      <div className="idea-list-head">
                        <strong>{idea.symbol}</strong>
                        <span>{idea.stance}</span>
                      </div>
                      <p>{idea.summary}</p>
                      <small>{idea.setup}</small>
                    </article>
                  ))}
                  {drawingHistory.slice(0, 3).map((entry) => (
                    <article key={entry.id} className="idea-list-card alt">
                      <div className="idea-list-head">
                        <strong>{entry.symbol} drawing</strong>
                        <span>{entry.score}/100</span>
                      </div>
                      <p>{entry.verdict}</p>
                      <small>{new Date(entry.createdAt).toLocaleString()}</small>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </article>
        ) : null}
      </section>

      {!profile ? (
        <section className="onboarding-overlay">
          <form className="onboarding-card surface-panel" onSubmit={saveProfile}>
            <p className="eyebrow">Personalized Setup</p>
            <h2>Tell the trader how to work with you</h2>
            <p className="body-copy">
              This onboarding tunes the coaching layer, risk framing, and explanation style so the platform can adapt to your needs.
            </p>

            <div className="form-grid">
              <label>
                Name
                  <input
                    className="field-ui"
                  value={draftProfile.name}
                  onChange={(event) => setDraftProfile((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Your name"
                />
              </label>

              <label>
                Trading proficiency
                <select
                  className="field-ui"
                  value={draftProfile.proficiency}
                  onChange={(event) => setDraftProfile((current) => ({ ...current, proficiency: event.target.value }))}
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </label>

              <label>
                Main goal
                <input
                  className="field-ui"
                  value={draftProfile.goal}
                  onChange={(event) => setDraftProfile((current) => ({ ...current, goal: event.target.value }))}
                />
              </label>

              <label>
                Risk tolerance
                <select
                  className="field-ui"
                  value={draftProfile.risk}
                  onChange={(event) => setDraftProfile((current) => ({ ...current, risk: event.target.value }))}
                >
                  <option>Conservative</option>
                  <option>Balanced</option>
                  <option>Aggressive</option>
                </select>
              </label>

              <label>
                Preferred style
                <select
                  className="field-ui"
                  value={draftProfile.style}
                  onChange={(event) => setDraftProfile((current) => ({ ...current, style: event.target.value }))}
                >
                  <option>Scalping</option>
                  <option>Day trading</option>
                  <option>Swing trading</option>
                  <option>Position trading</option>
                </select>
              </label>

              <label>
                Teaching mode
                <select
                  className="field-ui"
                  value={draftProfile.learning}
                  onChange={(event) => setDraftProfile((current) => ({ ...current, learning: event.target.value }))}
                >
                  <option>Direct coaching</option>
                  <option>Step-by-step lessons</option>
                  <option>Challenge me</option>
                </select>
              </label>
            </div>

            <button type="submit" className="primary-button btn-primary">
              Launch my trading workspace
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
