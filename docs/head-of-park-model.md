# Head of Park flow model

There is no stream gage at the Bend Whitewater Park, so the site estimates flow at the head of the park from upstream USBR Hydromet gages. This note records how the estimate works, how the travel-time lag was calibrated, and what the site used before (rmmanalytics.com), in case we ever need to revisit it.

## Current model (since Oct 2026)

```
Q_park(t) = k × Q_BENO(t − τ) − Q_CENO(t) − Q_ARNO(t)
```

| Term | Value | Source |
|---|---|---|
| `Q_BENO` | Deschutes R. at Benham Falls, `beno q` | Hydromet, 15-min |
| `Q_CENO` | Central Oregon Canal diversion, `ceno qc` | Hydromet, 15-min |
| `Q_ARNO` | Arnold Canal diversion, `arno qc` (often reports a step late; forward-filled) | Hydromet, 15-min |
| `k` | 0.93 (provisional) | Inherited from rmmanalytics; see below |
| `τ` | 20 km ÷ 2.3 km/h ≈ 8.75 h | Calibrated, see below |

Canal diversions are applied without a lag because both diversions sit much closer to the park than Benham Falls does.

**Outlook.** BENO readings from the last τ hours haven't reached the park yet. Holding the canals at their latest values, the model therefore knows Q_park for the next τ hours. The API returns this as `current.forecast` and `timeSeries.flowForecast`. The outlook doesn't cover future canal changes or a Wickiup release change that hasn't yet reached Benham Falls (WICO → BENO adds ~28 h more).

**Overrides** (environment variables, no code change needed): `HOP_BENO_FACTOR`, `HOP_BENO_TO_PARK_KM`, `HOP_CELERITY_KMH`, `HOP_LAG_HOURS` (overrides the distance/celerity calculation).

## Lag calibration

What travels downstream is a *change in flow*, which moves as a kinematic wave. That wave is faster than the water itself, and it attenuates (spreads out) as it goes.

**WICO → BENO (65 river km).** We pulled Hydromet 15-min data for 2023–2026 and found 18 isolated Wickiup release steps (≥ 60 cfs, with WICO and the Little Deschutes steady around each one). Lag was measured from the WICO 50% crossing to the BENO 50% crossing.
- Median lag ≈ 28 h (range 21–34 h). That gives a celerity of ≈ 2.3 km/h.
- The 10–90% rise at BENO takes 17–39 h, so a sharp release step arrives at Benham Falls as a day-long ramp.
- There was no clear dependence on discharge in the 950–1,700 cfs range sampled.

**Transfer to BENO → park (20 river km, measured in GIS).** 20 ÷ 2.3 ≈ 8.7 h. The lower reach (Lava Island canyon) is steeper than WICO → BENO, so the true lag may be somewhat shorter.

**Cross-check: BENO → DEBO** (USGS 14070500, below Bend, downstream of the park). In winter, when the gaged canals are off, cross-correlation of 3-h flow changes peaks at ~11 h. The cleanest individual events fall at 8–13 h. Since DEBO is below the park, this is an upper bound, and it's consistent with ~8–9 h at the park. (During irrigation season this check doesn't work, because the Pilot Butte Canal at North Canal Dam isn't on Hydromet.)

**Validation to do.** Watch the webcam after a known BENO change and note when the wave responds. A handful of observations would pin τ down better than any transfer.

## The `k = 0.93` factor

This came from rmmanalytics and has no documented basis. For context: in winter, with the gaged canals near zero, DEBO runs at a median of ~0.88 of BENO (10th–90th percentile 0.84–0.95). So some loss between Benham Falls and Bend is real, and a few percent by the park is plausible. That number also mixes in gage error and any ungaged winter deliveries, though, so it doesn't calibrate k. Treat 0.93 as provisional.

## Previous source: rmmanalytics.com (removed Oct 2026)

Until Oct 2026 the site fetched these CSVs from `https://rmmanalytics.com/Lleds_Water_Levels/`:

| File | Contents |
|---|---|
| `GREENWAVE_Year.csv` | `Date, CFS @ Head of Park`, plus constant surf thresholds (650 / 550 / 800) |
| `WICO_BENO_CENO_ARNO_HEAD_LAPO.csv` | `Date, below_Wickiup_Res, BENO, CENO, ARNO, HeadOfPark, LAPO` (15-min, ~3 weeks) |
| `WICO-BENO-Whitewater.csv` | `Date, below_Wickiup_Res, BENO, HeadOfPark` |
| `GREENWAVE_13to20Year.csv` | Multi-year daily Head of Park flow, one column per year |
| `BENOWaterAirTemp.csv` | BENO water temp, air temp, and constant wetsuit bands |

**How rmmanalytics computed Head of Park.** We checked all 1,994 rows (Sep 10 – Oct 1, 2026), and every one matches exactly:

```
HeadOfPark = 0.93 × BENO − CENO − ARNO      (same timestamp, no lag)
```

Each of their raw gage columns matches Hydromet `beno q`, `ceno qc`, `arno qc`, `wico q`, `lapo q` value for value, with ARNO forward-filled when it reports late. The only differences in the current model are the travel-time lag and the outlook.
