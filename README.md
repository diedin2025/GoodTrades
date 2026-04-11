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

## Notes

- This is a front-end prototype that demonstrates evaluation logic and dashboard behavior.
- The charts and model outputs are simulated so the workflow can be reviewed without a live backend.
- A production version would connect the UI to queued eval jobs, model adapters, persistent metrics storage, and alerting services.
