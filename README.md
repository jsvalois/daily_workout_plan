# Daily Workout Companion — Volume Tracker (No EMOM)

**Goal:** Focus on progressive overload by tracking **reps × weight** volume.  
Example: *3 sets × 10 reps × 10 lb* → **300 lb** total volume for that category.

## Features
- Live clock
- Pick up to **4 exercises** and set one as **Active** for logging
- **Big image** for the active exercise (image‑first via `image_map.json`; placeholder if missing)
- Log **reps, weight, unit, notes** — with **batch logging** of identical sets
- **Totals & progress**: per‑set volume, totals by **exercise** and by **category**, overall statistics
- **Range filter**: Today / 7d / 30d / All
- **Display unit**: lb or kg (mixed logs are converted for display)
- **Export CSV/JSON**, **Import JSON**, **Clear**
- **Offline** capable (Service Worker + Manifest)

## Add your images
Place images at `assets/exercises/` named by code (`C1.jpg`, `B2.jpg`, …) or set direct paths/URLs in `image_map.json`.  
Suggestion: 1600–2200 px width, JPG 75–85% quality (PNG only if needed).

## Publish on GitHub Pages
```bash
git init
git add .
git commit -m "Add DWC Volume tracker (no EMOM)"
git branch -M main
git remote add origin git@github.com:USERNAME/daily_workout_plan.git
git push -u origin main
```
Then enable **Settings → Pages → Deploy from branch → main / root**.

## CSV columns
- `ts`, `date`, `exercise`, `name`, `group`, `reps`, `weight`, `unit`, `volume` (native unit), `volume_lb`, `volume_kg`, `notes`

> Totals are displayed in your selected **Display unit** with conversions (1 kg = 2.2046226218 lb).
