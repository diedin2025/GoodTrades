# USDA AI Evals Engine

React + Tailwind CSS prototype for a USDA-style AI evaluation dashboard.

## Included features

- TEVVRL scoring for Test, Evaluation, Verification, Reliability, and Leniency
- Validation score calculated as `(T + E + V + R + L) / 5`
- User-controlled pass/fail threshold for model release decisions
- Side-by-side prompt comparison for two LLMs
- Continuous monitoring graphs that compare average versus current performance
- Genre selector for Business, Science, Healthcare, Math, and Art
- Scalable API and CI/CD pipeline framing for production rollout
- Lightweight Node backend for health checks, model metadata, evaluation, comparison, and trend APIs

## Notes

- The React UI and backend share the same eval engine module so the scoring math stays consistent.
- The backend is intentionally lightweight and local-first, giving you a concrete API without adding extra packages.
- A production version would connect the API layer to queued eval jobs, model adapters, persistent metrics storage, and alerting services.

## Backend API

- `npm run api` starts the backend on `http://localhost:8787`
- `npm run dev:api` starts the backend in watch mode
- `GET /api/health` returns service health
- `GET /api/genres` returns supported genres and default prompts
- `GET /api/models` returns available model metadata
- `GET /api/trends?genre=Business&modelId=gpt5` returns current score plus historical trend data
- `POST /api/evaluate` evaluates one model for a prompt
- `POST /api/compare` compares two models head-to-head

## Local development

- Terminal 1: `npm run dev:api`
- Terminal 2: `npm run dev`
- Vite proxies `/api/*` requests to `http://127.0.0.1:8787`
- Optional: set `VITE_API_BASE_URL` if your backend runs on a different host
