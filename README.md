# Bend Surf Report

**Live site:** [bendsurfreport.com](https://www.bendsurfreport.com)

Real-time conditions for the surf wave at the Bend Whitewater Park on the Deschutes River in Bend, Oregon. It pulls together river flow, water temperature, upstream reservoir and canal data, weather and air quality, so surfers can decide whether the wave is worth the trip.

## What it shows

- **Live overview:** flow at the Head of Park, surf status, wetsuit recommendation, a short written surf report, and the river webcam.
- **Lowers report:** the weekly tune schedule for the lower wave.
- **River flow:** flow history, the upstream hydro network (Wickiup → Benham Falls → canal diversions → park), and Wickiup Reservoir storage.
- **Temperature and weather:** water and air temperature trends and the forecast.
- **Historical:** flows compared across past years.

### Surf status (CFS at Head of Park)

| Flow | Status |
| --- | --- |
| 800+ | Firing |
| 650–799 | Surfing |
| 550–649 | Low-surfable |
| < 550 | Below minimum |

## Data sources

Fetched server-side in `api/surf-data.ts` (cached for 3 minutes):

- **USBR Hydromet** (15-minute and daily): Benham Falls flow and water temperature (BENO), below Wickiup (WICO), Little Deschutes (LAPO), Central Oregon and Arnold canal diversions (CENO, ARNO), and Wickiup Reservoir storage
- **USGS** instantaneous values: Deschutes River below Bend (14070500) and near Madras (14092500)
- **Open-Meteo:** weather and air quality
- **PurpleAir** sensor 61853 (optional API key)

There is no gage at the park, so Head of Park flow is modeled in `api/_lib/headOfPark.ts`:

```
Q_park(t) = 0.93 × Q_BENO(t − τ) − Q_CENO(t) − Q_ARNO(t)
τ = 20 river km ÷ 2.3 km/h ≈ 8.75 h
```

τ is the time a flow change takes to travel from Benham Falls to the park. It is calibrated from Wickiup release steps (WICO → BENO). Because of that lag, the last ~9 hours of BENO readings haven't reached the park yet, so the site can show a short outlook. All parameters can be overridden with environment variables (`HOP_BENO_FACTOR`, `HOP_BENO_TO_PARK_KM`, `HOP_CELERITY_KMH`, `HOP_LAG_HOURS`). See [docs/head-of-park-model.md](docs/head-of-park-model.md) for the calibration and for notes on the rmmanalytics estimate it replaces.

The written surf report comes from `api/ai-surf-report.ts` (Google Gemini).

## Stack

React 19, Vite 6, Tailwind CSS 4, Recharts and lucide-react in `src/`. Serverless API functions in `api/`. Hosted on Vercel: `main` deploys to production, and every pull request gets its own preview URL.

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env   # then add your own GEMINI_API_KEY (and PURPLE_AIR_API_KEY if you have one)
npm run dev            # http://localhost:3000
```

`npm run dev` starts `server.ts`, which serves the front end and the `api/` handlers together, matching how Vercel runs them.

Other scripts:

- `npm run lint` type-checks the project
- `npm run build` builds the production bundle into `dist/`

Never commit `.env` or API keys. In production, keys live in Vercel Environment Variables.

## Making changes

1. Work on a branch, not `main`.
2. Open a pull request. Vercel builds a preview URL automatically.
3. Check the preview on a phone.
4. Merge. Vercel deploys `main` to bendsurfreport.com.
