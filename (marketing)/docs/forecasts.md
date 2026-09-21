# Forecasts (R-141–R-149)

Deterministic, no model server. `lib/core/predict.ts`:

- `linearForecast`: least-squares over up to 6 prior weeks per group.
- Bands, not points: `forecastBands` widens with slope and volatility (R-141).
- `mape` + `backtestForecast`: accuracy tracked per group over history (R-142).
- `explainForecast`: drivers are trend + volatility in plain words (R-143).
- Wired into both answer APIs as `forecasts` (opt-out per org: `predictOptOut`, R-147).
- Data-as-of rides the answer meta — forecasts are always labeled stale when the
  week is (R-146 note).
- What-if sandbox: `POST /api/answers/whatif` (R-144) — group + costDelta in,
  before/after out, nothing saved.
- Budget vs actual: agency project-list `Budget` flows into `budget` +
  `budgetVsActual` per project (R-145).
- Backtest harness (R-149): `backtestForecast` over any history array; engine
  integration tests pin no-NaN on real engine output.

Limits: 6 weeks of history, linear only, no seasonality (R-152 open), no LLM.
