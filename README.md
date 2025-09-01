# Saturday Signal (no-setup deploy)

A self-updating college football **watch guide** with a **WatchScore** that ranks the best games each Saturday (and re-ranks live).

## One‑click deploy (no coding)

1. Create a free account at **Vercel** (vercel.com).
2. Click **New Project → Import** this folder (or upload the ZIP).
3. In **Environment Variables**, add:
   - `CFBD_API_KEY` = (your CollegeFootballData key)
   - (optional) `ODDS_API_KEY` = (The Odds API key)
4. Deploy. Open your URL. It works on phone + Add to Home Screen (PWA-like).

> Don’t have keys yet? Deploy anyway. The site falls back to **demo data** so you can see it working.

## What it does
- Serverless API `/api/slate` fetches:
  - CFBD games & rankings (importance inputs)
  - (optional) odds for spreads/totals (watchability inputs)
- Frontend shows **This Week** by windows (Noon/Afternoon/Prime/Late), allows **weight sliders**, and a **planner**.
- If a fetch fails or you didn’t provide keys, it shows **Demo Mode** data with a banner.

## Local dev
```bash
npm i
npm run dev
```
