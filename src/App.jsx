import { useDeferredValue, useState } from "react";

const GENRES = [
  "Business",
  "Science",
  "Healthcare",
  "Math",
  "Art",
];

const MODEL_OPTIONS = [
  {
    id: "gpt5",
    name: "GPT-5 Class",
    lane: "Frontier generalist",
    tagline: "Strong policy alignment and high consistency across mixed-domain prompts.",
    standout: "Best for broad agency workflows",
    color: "#8b5cf6",
    averages: {
      Business: { test: 8.9, evaluation: 8.7, verification: 8.8, reliability: 8.6, leniency: 7.5 },
      Science: { test: 9.1, evaluation: 8.8, verification: 8.9, reliability: 8.7, leniency: 7.2 },
      Healthcare: { test: 8.7, evaluation: 8.4, verification: 8.8, reliability: 8.7, leniency: 6.8 },
      Math: { test: 9.2, evaluation: 8.9, verification: 9.1, reliability: 8.5, leniency: 7.1 },
      Art: { test: 8.4, evaluation: 8.8, verification: 8.1, reliability: 8.4, leniency: 7.9 },
    },
  },
  {
    id: "deepseek",
    name: "DeepSeek Reasoning",
    lane: "Open-weight reasoning",
    tagline: "High verification depth and strong math/science tradecraft with looser guardrails.",
    standout: "Best for cost-aware analysis",
    color: "#d946ef",
    averages: {
      Business: { test: 8.1, evaluation: 8.2, verification: 8.5, reliability: 7.9, leniency: 6.9 },
      Science: { test: 8.8, evaluation: 8.4, verification: 8.8, reliability: 8.1, leniency: 6.7 },
      Healthcare: { test: 7.9, evaluation: 7.8, verification: 8.4, reliability: 7.7, leniency: 6.3 },
      Math: { test: 9.0, evaluation: 8.7, verification: 9.2, reliability: 8.0, leniency: 6.8 },
      Art: { test: 7.8, evaluation: 8.1, verification: 7.6, reliability: 7.7, leniency: 7.4 },
    },
  },
  {
    id: "usda-tuned",
    name: "USDA Guardrail Tune",
    lane: "Fine-tuned agency model",
    tagline: "Safer, more conservative outputs with strong validation in regulated domains.",
    standout: "Best for compliance-heavy review",
    color: "#6366f1",
    averages: {
      Business: { test: 7.9, evaluation: 8.1, verification: 8.0, reliability: 8.5, leniency: 8.4 },
      Science: { test: 8.0, evaluation: 7.9, verification: 8.1, reliability: 8.6, leniency: 8.2 },
      Healthcare: { test: 8.5, evaluation: 8.3, verification: 8.6, reliability: 8.9, leniency: 8.5 },
      Math: { test: 7.8, evaluation: 7.6, verification: 8.2, reliability: 8.3, leniency: 8.0 },
      Art: { test: 7.2, evaluation: 7.8, verification: 7.4, reliability: 8.1, leniency: 8.6 },
    },
  },
];

const DOMAIN_PROMPTS = {
  Business:
    "Draft an executive brief for a USDA supply-chain pilot, including risks, ROI assumptions, and one recommended next step.",
  Science:
    "Summarize an agricultural soil-carbon experiment, note uncertainty, and propose a follow-up hypothesis.",
  Healthcare:
    "Compare two patient-facing care coordination messages and explain which one is safer and more empathetic.",
  Math:
    "Explain how to solve a multistep optimization problem, show the reasoning path, and identify likely error points.",
  Art:
    "Create a creative direction memo for a public-awareness campaign spanning design, music, film, and writing.",
};

const TIME_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

const STANDOUT_FACTORS = [
  {
    title: "TEVVRL as code",
    text: "Every run scores Test, Evaluation, Verification, Reliability, and Leniency out of 10, then turns that into a validation verdict automatically.",
  },
  {
    title: "Continuous drift watch",
    text: "The platform stores historical benchmarks, overlays current and average performance, and flags regressions before weak models reach production.",
  },
  {
    title: "Scalable API backbone",
    text: "Queued eval jobs, model adapters, time-series metrics, and dashboard APIs let agencies compare many LLMs without bottlenecking on manual review.",
  },
];

const PIPELINE_STEPS = [
  "Prompt intake and corpus scan",
  "Dual-model execution",
  "TEVVRL scoring",
  "Head-to-head model ranking",
  "Trend storage and alerts",
  "Dashboard and CI/CD release decision",
];

const ARCHITECTURE_ITEMS = [
  "API gateway accepts eval suites, batch traffic, and prompt-level experiments.",
  "Queue workers fan requests out to hosted APIs or open-source model adapters.",
  "Scoring services persist TEVVRL metrics, reasons, and pass-fail decisions.",
  "Time-series storage drives overlapping graphs for average versus current performance.",
  "Alerting automation opens tickets when drift or threshold failures appear.",
  "Model registry tracks rolling upgrades so LLM refreshes stay measurable instead of invisible.",
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function getModel(modelId) {
  return MODEL_OPTIONS.find((model) => model.id === modelId) ?? MODEL_OPTIONS[0];
}

function getPromptComplexity(prompt) {
  if (!prompt.trim()) {
    return 0;
  }

  const wordCount = prompt.trim().split(/\s+/).length;
  return clamp(wordCount / 22, 0, 1.9);
}

function scoreModel(model, genre, prompt) {
  const baseline = model.averages[genre];
  const complexity = getPromptComplexity(prompt);
  const cautionBoost = genre === "Healthcare" ? 0.25 : 0;
  const creativityBoost = genre === "Art" ? 0.2 : 0;
  const verificationDelta = model.id === "deepseek" ? 0.25 : model.id === "usda-tuned" ? 0.1 : 0.15;
  const leniencyDelta = model.id === "usda-tuned" ? 0.35 : model.id === "gpt5" ? -0.05 : -0.15;

  const current = {
    test: round(clamp(baseline.test - complexity * 0.35 + creativityBoost, 0, 10)),
    evaluation: round(clamp(baseline.evaluation - complexity * 0.28 + cautionBoost, 0, 10)),
    verification: round(clamp(baseline.verification - complexity * 0.18 + verificationDelta, 0, 10)),
    reliability: round(clamp(baseline.reliability - complexity * 0.24 + cautionBoost, 0, 10)),
    leniency: round(clamp(baseline.leniency + leniencyDelta - complexity * 0.12, 0, 10)),
  };

  const validation = round(
    (current.test + current.evaluation + current.verification + current.reliability + current.leniency) / 5
  );

  const reasons = [
    current.verification >= 8.8 ? "Strong verification trail" : "Verification needs closer review",
    current.reliability >= 8.5 ? "Stable under repeat traffic" : "Reliability may dip under load spikes",
    current.leniency <= 7 ? "Tighter guardrails reduce unsafe flexibility" : "Model is permissive and may need stricter policy filters",
  ];

  return {
    current,
    validation,
    reasons,
    status: validation >= 0 ? "ready" : "ready",
  };
}

function buildTrend(model, genre, currentValidation) {
  const base = model.averages[genre];
  const averageValidation = round(
    (base.test + base.evaluation + base.verification + base.reliability + base.leniency) / 5
  );

  const averageSeries = TIME_LABELS.map((_, index) => round(averageValidation - 0.15 + index * 0.03));
  const currentSeries = TIME_LABELS.map((_, index) => {
    const sway = Math.sin(index * 1.1 + averageValidation) * 0.32;
    return round(clamp(currentValidation - 0.38 + index * 0.07 + sway, 0, 10));
  });

  return { averageSeries, currentSeries, averageValidation };
}

function buildResponse(model, genre, prompt, validation) {
  const focusByGenre = {
    Business: "cost, policy, and measurable rollout steps",
    Science: "evidence, uncertainty, and experimental rigor",
    Healthcare: "safety, empathy, and escalations to human review",
    Math: "traceable reasoning and error checking",
    Art: "creative direction with clear audience intent",
  };

  const posture =
    model.id === "usda-tuned"
      ? "cautious and compliance-forward"
      : model.id === "deepseek"
        ? "analytical and detail-heavy"
        : "balanced and production-ready";

  return `This ${model.name} response is ${posture}, emphasizing ${focusByGenre[genre]}. For the prompt "${prompt.trim()}", the engine projects a composite comparison score of ${validation}/10 in this head-to-head run.`;
}

function toPoints(series) {
  return series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * 100;
      const y = 100 - value * 10;
      return `${x},${y}`;
    })
    .join(" ");
}

function ScorePill({ label, value }) {
  return (
    <div className="score-pill rounded-3xl border border-[color:var(--line)] bg-white/5 p-4">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrendChart({ model, trend }) {
  return (
    <div className="chart-card rounded-[30px] border border-[color:var(--line)] bg-[color:var(--panel)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
      <div className="chart-header flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="micro-label">Performance Over Time</p>
          <h3>{model.name}</h3>
        </div>
        <div className="chart-legend flex flex-wrap justify-end gap-3">
          <span><i className="legend-line average" />Average</span>
          <span><i className="legend-line current" style={{ "--line-color": model.color }} />Current</span>
        </div>
      </div>
      <div className="chart-shell mt-4">
        <svg viewBox="0 0 100 100" className="chart-svg" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={toPoints(trend.averageSeries)} className="average-line" />
          <polyline points={toPoints(trend.currentSeries)} className="current-line" style={{ "--line-color": model.color }} />
        </svg>
        <div className="chart-labels">
          {TIME_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
      <div className="chart-summary mt-4 flex flex-col gap-3 md:flex-row">
        <div>
          <span>Average</span>
          <strong>{trend.averageValidation}</strong>
        </div>
        <div>
          <span>Current</span>
          <strong>{trend.currentSeries.at(-1)}</strong>
        </div>
        <div>
          <span>Delta</span>
          <strong>{round(trend.currentSeries.at(-1) - trend.averageValidation)}</strong>
        </div>
      </div>
    </div>
  );
}

function ModelCard({ model, score, winner, response }) {
  return (
    <article className="model-card rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-5">
      <div className="model-topline flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="micro-label">{model.lane}</p>
          <h3>{model.name}</h3>
        </div>
        <span className={`status-pill ${winner ? "pass" : "fail"}`}>{winner ? "Leads" : "Trails"}</span>
      </div>
      <p className="supporting-text">{model.tagline}</p>
      <div className="score-grid mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
        <ScorePill label="Test" value={score.current.test} />
        <ScorePill label="Evaluation" value={score.current.evaluation} />
        <ScorePill label="Verification" value={score.current.verification} />
        <ScorePill label="Reliability" value={score.current.reliability} />
        <ScorePill label="Leniency" value={score.current.leniency} />
        <ScorePill label="Validation" value={score.validation} />
      </div>
      <div className="response-box mt-4 rounded-3xl border border-[color:var(--line)] bg-white/5 p-5">
        <p className="micro-label">Prompt Comparison Output</p>
        <p>{response}</p>
      </div>
      <div className="reason-list mt-4 flex flex-wrap gap-2.5">
        {score.reasons.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>
    </article>
  );
}

export default function App() {
  const [genre, setGenre] = useState("Business");
  const [primaryModelId, setPrimaryModelId] = useState("gpt5");
  const [secondaryModelId, setSecondaryModelId] = useState("deepseek");
  const [prompt, setPrompt] = useState(DOMAIN_PROMPTS.Business);

  const deferredPrompt = useDeferredValue(prompt);

  const primaryModel = getModel(primaryModelId);
  const secondaryModel = getModel(secondaryModelId);
  const primaryScore = scoreModel(primaryModel, genre, deferredPrompt);
  const secondaryScore = scoreModel(secondaryModel, genre, deferredPrompt);
  const primaryTrend = buildTrend(primaryModel, genre, primaryScore.validation);
  const secondaryTrend = buildTrend(secondaryModel, genre, secondaryScore.validation);

  const comparisonGap = round(primaryScore.validation - secondaryScore.validation);
  const betterModel = comparisonGap >= 0 ? primaryModel.name : secondaryModel.name;
  const primaryWinner = comparisonGap >= 0;
  const secondaryWinner = comparisonGap < 0;

  return (
    <main className="app-shell relative min-h-screen overflow-hidden bg-[#090511] px-5 py-5 md:px-8">
      <div className="backdrop-orb orb-one" />
      <div className="backdrop-orb orb-two" />
      <div className="backdrop-grid" />

      <section className="hero relative z-10 mx-auto mb-6 grid w-full max-w-[1280px] gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.95fr)]">
        <div className="hero-copy rounded-[30px] border border-[color:var(--line)] bg-[color:var(--panel)] p-10 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
          <p className="eyebrow">USDA AI Evals Engine</p>
          <h1>AIMetrics: Which AI Model Would You Trust?</h1>
          <p className="hero-text">
            A scalable TEVVRL evaluation control center that tests LLMs, compares them side-by-side,
            monitors drift over time, and clearly shows which model performs better for the prompt you are testing.
          </p>
          <div className="hero-badges mt-6 flex flex-wrap gap-2.5">
            <span>TEVV pipelines</span>
            <span>Scalable API</span>
            <span>Continuous monitoring</span>
          </div>
        </div>

        <div className="hero-panel rounded-[30px] border border-[color:var(--line)] bg-[color:var(--panel)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
          <p className="micro-label">What Makes It Stand Out</p>
          <div className="standout-grid grid gap-3.5">
            {STANDOUT_FACTORS.map((item) => (
              <article key={item.title} className="standout-card rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-[18px]">
                <h2>{item.title}</h2>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="workspace-grid relative z-10 mx-auto grid w-full max-w-[1280px] gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.76fr)]">
        <div className="panel controls-panel rounded-[30px] border border-[color:var(--line)] bg-[color:var(--panel)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
          <div className="panel-heading flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="eyebrow">Interactive Evaluation</p>
              <h2>Run a live comparison</h2>
            </div>
            <div className="summary-chip rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-left md:min-w-[140px] md:text-right">
              <span>Current winner</span>
              <strong>{betterModel}</strong>
            </div>
          </div>

          <div className="control-grid mt-6 grid gap-3.5 md:grid-cols-3">
            <label className="control-field grid gap-2.5">
              <span>Genre</span>
              <select
                className="w-full rounded-[18px] border border-[color:var(--line)] bg-white/5 px-4 py-3 text-[color:var(--text)] outline-none transition focus:border-[rgba(168,85,247,0.75)] focus:shadow-[0_0_0_4px_rgba(168,85,247,0.12)]"
                value={genre}
                onChange={(event) => {
                  const nextGenre = event.target.value;
                  setGenre(nextGenre);
                  setPrompt(DOMAIN_PROMPTS[nextGenre]);
                }}
              >
                {GENRES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="control-field grid gap-2.5">
              <span>Model A</span>
              <select
                className="w-full rounded-[18px] border border-[color:var(--line)] bg-white/5 px-4 py-3 text-[color:var(--text)] outline-none transition focus:border-[rgba(168,85,247,0.75)] focus:shadow-[0_0_0_4px_rgba(168,85,247,0.12)]"
                value={primaryModelId}
                onChange={(event) => setPrimaryModelId(event.target.value)}
              >
                {MODEL_OPTIONS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="control-field grid gap-2.5">
              <span>Model B</span>
              <select
                className="w-full rounded-[18px] border border-[color:var(--line)] bg-white/5 px-4 py-3 text-[color:var(--text)] outline-none transition focus:border-[rgba(168,85,247,0.75)] focus:shadow-[0_0_0_4px_rgba(168,85,247,0.12)]"
                value={secondaryModelId}
                onChange={(event) => setSecondaryModelId(event.target.value)}
              >
                {MODEL_OPTIONS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="prompt-field mt-5 grid gap-2.5">
            <span>Prompt under test</span>
            <textarea
              className="w-full rounded-[18px] border border-[color:var(--line)] bg-white/5 px-4 py-3 text-[color:var(--text)] outline-none transition focus:border-[rgba(168,85,247,0.75)] focus:shadow-[0_0_0_4px_rgba(168,85,247,0.12)]"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Type a prompt to compare how the models respond."
              rows={5}
            />
          </label>

          <div className="comparison-banner mt-5 flex flex-col gap-4 rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-5 py-[18px] md:flex-row md:items-start md:justify-between">
            <div>
              <p className="micro-label">Decision</p>
              <h3>{betterModel} leads this run</h3>
            </div>
            <div className="banner-metrics flex flex-wrap gap-2.5 md:justify-end">
              <span>Gap {Math.abs(comparisonGap)}</span>
              <span>Best composite score wins</span>
            </div>
          </div>

          <div className="model-grid mt-5 grid gap-[18px] 2xl:grid-cols-2">
            <ModelCard
              model={primaryModel}
              score={primaryScore}
              winner={primaryWinner}
              response={buildResponse(primaryModel, genre, deferredPrompt, primaryScore.validation)}
            />
            <ModelCard
              model={secondaryModel}
              score={secondaryScore}
              winner={secondaryWinner}
              response={buildResponse(secondaryModel, genre, deferredPrompt, secondaryScore.validation)}
            />
          </div>
        </div>

        <aside className="sidebar grid gap-6 xl:sticky xl:top-6">
          <section className="panel sidebar-panel rounded-[30px] border border-[color:var(--line)] bg-[color:var(--panel)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
            <p className="eyebrow">TEVV + RL Logic</p>
            <h2>Validation is the average</h2>
            <p className="supporting-text">
              Validation is computed as the average of Test, Evaluation, Verification, Reliability, and Leniency.
              The engine compares those composite scores directly and surfaces the stronger model for the current prompt.
            </p>
            <div className="formula-card mt-[18px] rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-[18px]">
              <span>Validation</span>
              <strong>(T + E + V + R + L) / 5</strong>
            </div>
            <div className="pipeline-list mt-[18px] grid gap-3">
              {PIPELINE_STEPS.map((step, index) => (
                <div key={step} className="pipeline-step grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-[18px] border border-[color:var(--line)] bg-white/5 px-4 py-3.5">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel sidebar-panel rounded-[30px] border border-[color:var(--line)] bg-[color:var(--panel)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
            <p className="eyebrow">Scalable API Design</p>
            <h2>Built for traffic</h2>
            <div className="architecture-list mt-[18px] grid gap-3">
              {ARCHITECTURE_ITEMS.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className="chart-grid relative z-10 mx-auto mt-6 grid w-full max-w-[1280px] gap-[18px] 2xl:grid-cols-2">
        <TrendChart model={primaryModel} trend={primaryTrend} />
        <TrendChart model={secondaryModel} trend={secondaryTrend} />
      </section>
    </main>
  );
}
