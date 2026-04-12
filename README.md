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

## Deploy backend + frontend

- The repo includes [render.yaml](/Users/ian/Documents/MorganHacks/render.yaml) so the backend can be deployed as a Render web service
- Render requires the app to bind to `0.0.0.0` and use the provided `PORT` value, which this backend supports via environment variables
- After Render gives you a public backend URL such as `https://morganhacks-api.onrender.com`, add a GitHub repository variable named `VITE_API_BASE_URL`
- Set that variable to your backend URL, then rerun the GitHub Pages workflow so the static frontend is built against the live API
- If `VITE_API_BASE_URL` is not set or the backend is down, the frontend falls back to static demo mode
