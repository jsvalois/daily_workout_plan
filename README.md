# Daily Workout Companion — Volume + Presets (HIIT link, no timers)

This site restores the **Session Presets** workflow and the **HIIT segment** link while keeping a **volume-first** strength logger.
- **HIIT:** Big button to open your 20‑minute HIIT video + an optional **Log HIIT Completed** (no timer used).
- **Presets:** Pick a day to auto-fill A/B exercises for two blocks (A1/B1 and A2/B2). Use **Set Active** to choose which image is displayed.
- **Logging:** Record **reps, weight, unit, notes**. Batch logging repeats identical sets N times.
- **Progress:** Totals by **exercise** and **muscle group**, overall volume, average reps/weight, and HIIT session count.
- **Filters:** Today / 7d / 30d / All, and lb/kg display with conversions.
- **Data:** Stored locally (localStorage). Export CSV/JSON. Import JSON. Offline-ready.

## Add your images
- Put files in `assets/exercises/` named by code (e.g., `C1.jpg`, `B2.jpg`) **or** edit `image_map.json` to point to your own paths/URLs.
- Suggested: 1600–2200 px width, JPG 75–85% quality.

## Publish on GitHub Pages
```bash
git init
git add .
git commit -m "Add DWC Volume + Presets (HIIT link, no timers)"
git branch -M main
git remote add origin git@github.com:USERNAME/daily_workout_plan.git
git push -u origin main
```
Enable **Settings → Pages → Deploy from branch → main / root**.
