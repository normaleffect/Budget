# Ledger

A budget, forecasting and goal-planning app for one specific household. It runs
in a phone browser, installs to the home screen like a real app, works offline,
and keeps every number in one connected model so changing anything on one screen
updates every other screen instantly.

## Getting it on your phone

**The short version:** once this is deployed, open the link on your phone,
tap the share button, and choose "Add to Home Screen". It then behaves like any
other app: its own icon, no browser bars, works with no signal.

### Turning on the website (one time, about two minutes)

GitHub can host this for free. Here is exactly what to click:

1. Go to the repository page on github.com.
2. Click **Settings** (top right of the repo, not your account settings).
3. In the left sidebar click **Pages**.
4. Under "Build and deployment" → Source, choose **GitHub Actions**.
5. That's it. Within a couple of minutes the site is live at
   `https://<your-username>.github.io/Budget/`.

Every time the code changes, it redeploys itself.

### If you'd rather not deal with any of that

Download the repository as a ZIP (green "Code" button → Download ZIP), unzip it,
and open `index.html` in a browser. Everything works except the offline install.

## What is in here

| File | What it does |
| --- | --- |
| `index.html` | The app shell and the five bottom tabs |
| `styles.css` | The whole design system, light and dark |
| `js/state.js` | Your numbers, and saving them to the phone |
| `js/tax.js` | Federal + FICA + self-employment + Georgia tax engine |
| `js/taxdata.js` | 2026 brackets, limits and Georgia rates, all editable |
| `js/engine.js` | The projection: cash flow, debt payoff, goals, net worth |
| `js/views/*.js` | The five tabs |
| `sw.js` | Makes it work with no internet |

No frameworks, no build step, no dependencies. It is plain JavaScript on
purpose, so it will still open in ten years.

## The five tabs

- **Home** — net worth, this month at a glance, goal progress, what to do next
- **Budget** — where every dollar goes, log actual spending, income, paycheck
- **Flow** — month-by-month cash flow for the next 1–2 years, one-off events
- **Goals** — every goal in priority order, debt payoff, account balances
- **Plan** — 25-year forecast, retirement, full tax breakdown, what-if scenarios,
  settings

## Your data

Everything is stored in your phone's browser. Nothing is uploaded anywhere, there
is no account, and no company sees your finances. The trade-off: clearing your
browser data deletes it. Use **Plan → Settings → Export backup** every month or so.

## A note on the numbers

The tax engine implements 2026 federal brackets, the standard deduction, the
child tax credit including the refundable portion, the QBI deduction, Social
Security and Medicare (including the self-employment version and the per-person
wage base), and Georgia's flat income tax with dependent exemptions and the
Path2College 529 deduction. It also models the first partial year separately,
since a job that starts mid-year is taxed nothing like a full one.

It is a planning tool, not tax advice. Three inputs are estimates that should be
replaced with real numbers as soon as they are known: the monthly health
insurance premium, the exact bonus structure, and the principal-and-interest
portion of the mortgage payment (currently derived, not read off a statement).

## Rebuilding the single-file version

The app has no build step. If you ever want one standalone `.html` file to host
somewhere else, `node tools/build-single-file.mjs dist/ledger.html` inlines
everything (needs `npm i esbuild` first).
