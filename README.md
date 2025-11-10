# Daily Workout Companion — Pro (Image-First)

A clean, GitHub Pages–ready site with:
- **Live clock**
- **EMOM session mode**: two 10‑min blocks (A/B pairs), viewer auto‑switches image every minute
- **Large exercise image** (from per‑exercise images you provide; placeholder if missing)
- **Logging UI** for reps/weight/notes → saved to **localStorage** with **CSV/JSON export** and **JSON import**
- **URL params** to deep‑link a session (e.g., `?a=C1&b=C5&a2=T1&b2=T2`)
- **Keyboard shortcuts**: Space=Start/Pause, N=Next round, R=Reset
- **Optional beep** at each minute
- **Offline support** via Service Worker

## Add your images
Place images in `assets/exercises/` named by code (`C1.jpg`, `B2.jpg`, …) **or** set full paths/URLs in `image_map.json`. If an image is missing, a gray placeholder is shown.

**Suggested export**: 1600–2200 px width, JPG 75–85% quality (PNG only when needed).

## Presets
The “Session presets” menu loads A/B selections for a 6‑day rotation (Chest + Triceps, Back + Biceps, etc.). Adjust as needed.

## Publish on GitHub Pages
```bash
git init
git add .
git commit -m "Add DWC Pro (image-first)"
git branch -M main
git remote add origin git@github.com:USERNAME/dwc-website-pro.git
git push -u origin main
```
Then enable **Settings → Pages → Deploy from branch → main / root**.

## Data privacy & rights
- Logs are stored only in your browser (`localStorage`).
- Ensure you have rights to publish the exercise images if your repo is public.
