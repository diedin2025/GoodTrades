export const GENRES = [
  "Business",
  "Science",
  "Healthcare",
  "Math",
  "Art",
];

export const MODEL_OPTIONS = [
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

export const DOMAIN_PROMPTS = {
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

export const TIME_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function round(value) {
  return Math.round(value * 10) / 10;
}

export function getModel(modelId) {
  return MODEL_OPTIONS.find((model) => model.id === modelId) ?? MODEL_OPTIONS[0];
}

export function getPromptComplexity(prompt) {
  if (!prompt.trim()) {
    return 0;
  }

  const wordCount = prompt.trim().split(/\s+/).length;
  return clamp(wordCount / 22, 0, 1.9);
}

export function scoreModel(model, genre, prompt) {
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
  };
}

export function buildTrend(model, genre, currentValidation) {
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

export function buildResponse(model, genre, prompt, validation) {
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

export function compareModels({ genre, prompt, modelAId, modelBId }) {
  const modelA = getModel(modelAId);
  const modelB = getModel(modelBId);
  const modelAScore = scoreModel(modelA, genre, prompt);
  const modelBScore = scoreModel(modelB, genre, prompt);
  const modelATrend = buildTrend(modelA, genre, modelAScore.validation);
  const modelBTrend = buildTrend(modelB, genre, modelBScore.validation);
  const comparisonGap = round(modelAScore.validation - modelBScore.validation);
  const winner = comparisonGap >= 0 ? modelA : modelB;

  return {
    genre,
    prompt,
    winner: {
      id: winner.id,
      name: winner.name,
      gap: Math.abs(comparisonGap),
    },
    modelA: {
      ...modelA,
      score: modelAScore,
      trend: modelATrend,
      response: buildResponse(modelA, genre, prompt, modelAScore.validation),
      winner: comparisonGap >= 0,
    },
    modelB: {
      ...modelB,
      score: modelBScore,
      trend: modelBTrend,
      response: buildResponse(modelB, genre, prompt, modelBScore.validation),
      winner: comparisonGap < 0,
    },
  };
}
