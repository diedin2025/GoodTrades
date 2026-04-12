import http from "node:http";
import { URL } from "node:url";
import {
  DOMAIN_PROMPTS,
  GENRES,
  MODEL_OPTIONS,
  buildResponse,
  buildTrend,
  compareModels,
  getModel,
  scoreModel,
} from "../src/lib/evalsEngine.js";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
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
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });
}

function validateGenre(genre) {
  return GENRES.includes(genre) ? genre : GENRES[0];
}

function validatePrompt(prompt, genre) {
  if (typeof prompt === "string" && prompt.trim()) {
    return prompt.trim();
  }

  return DOMAIN_PROMPTS[genre];
}

function validateModelId(modelId, fallback) {
  return MODEL_OPTIONS.some((model) => model.id === modelId) ? modelId : fallback;
}

function sanitizeModel(model) {
  const { averages, ...safeModel } = model;
  return safeModel;
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 404, { error: "Not Found", message: "Missing request URL." });
    return;
  }

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const { pathname, searchParams } = url;

  try {
    if (request.method === "GET" && pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        service: "usda-ai-evals-engine",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/genres") {
      sendJson(response, 200, {
        genres: GENRES,
        prompts: DOMAIN_PROMPTS,
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/models") {
      sendJson(response, 200, {
        models: MODEL_OPTIONS.map(sanitizeModel),
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/trends") {
      const genre = validateGenre(searchParams.get("genre") || GENRES[0]);
      const modelId = validateModelId(searchParams.get("modelId"), MODEL_OPTIONS[0].id);
      const prompt = validatePrompt(searchParams.get("prompt"), genre);
      const model = getModel(modelId);
      const score = scoreModel(model, genre, prompt);
      const trend = buildTrend(model, genre, score.validation);

      sendJson(response, 200, {
        genre,
        prompt,
        model: sanitizeModel(model),
        score,
        trend,
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/evaluate") {
      const body = await parseBody(request);
      const genre = validateGenre(body.genre || GENRES[0]);
      const modelId = validateModelId(body.modelId, MODEL_OPTIONS[0].id);
      const prompt = validatePrompt(body.prompt, genre);
      const model = getModel(modelId);
      const score = scoreModel(model, genre, prompt);
      const trend = buildTrend(model, genre, score.validation);

      sendJson(response, 200, {
        genre,
        prompt,
        model: sanitizeModel(model),
        score,
        trend,
        response: buildResponse(model, genre, prompt, score.validation),
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/compare") {
      const body = await parseBody(request);
      const genre = validateGenre(body.genre || GENRES[0]);
      const prompt = validatePrompt(body.prompt, genre);
      const modelAId = validateModelId(body.modelAId, MODEL_OPTIONS[0].id);
      const modelBId = validateModelId(body.modelBId, MODEL_OPTIONS[1].id);

      sendJson(
        response,
        200,
        compareModels({
          genre,
          prompt,
          modelAId,
          modelBId,
        })
      );
      return;
    }

    sendJson(response, 404, {
      error: "Not Found",
      message: "The requested endpoint does not exist.",
    });
  } catch (error) {
    const statusCode = error.message === "Payload too large" ? 413 : 400;
    sendJson(response, statusCode, {
      error: "Request Failed",
      message: error.message,
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`USDA AI Evals backend running at http://${HOST}:${PORT}`);
});
