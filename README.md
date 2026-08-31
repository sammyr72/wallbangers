# WALLBANGERS — website

Static marketing site for *WALLBANGERS Racquetball VR*. Same shape as the
Atomic Smash Lab site: plain HTML/CSS/JS, no build step, no dependencies.

```
index.html      the site
privacy.html    privacy policy (Meta store submission needs a public URL for this)
styles.css      all styling
app.js          store links, reveals, hero canvas, lightbox, trailer embed
shots/          screenshots (full + -thumb pairs, 16:9)
icon.png        favicon + nav mark
og.jpg          social share card
```

Total ~1.5 MB. Open `index.html` directly in a browser to preview — everything
is relative, nothing needs a server.

## The one thing to edit

`app.js`, line ~14:

```js
var STORE_URL = '';
```

Paste the Meta Horizon Store listing URL between the quotes and all three
"Get it on Quest" buttons wire themselves up. While it's empty they render as
a non-clickable **"Coming to Quest"** state instead of a dead link — safe to
ship as-is before the listing goes live.

## Hosting — GitHub Pages

The repo is the site; there is no build step, so Pages serves it straight from
the default branch root.

One-time setup on GitHub: **Settings → Pages → Source: Deploy from a branch**,
branch `main`, folder `/ (root)`. The site then lives at
`https://sammyr72.github.io/wallbangers/`.

Day to day:

```bash
git add -A && git commit -m "Update site" && git push
```

Pages redeploys on push, usually within a minute.

## Notes

- Fonts come from Google Fonts (Anton / Barlow / Barlow Condensed). Everything
  else is local, so the site works offline apart from the typefaces.
- The trailer only loads the YouTube iframe when someone clicks the poster, so
  the page costs nothing until then. Video ID lives in `data-video` on
  `#trailerBox` in `index.html`.
- Screenshots were generated from the Quest gallery captures; regenerate the
  `-thumb` pairs at 880px wide and the full versions at 1760px if you swap any.
- `privacy.html` describes what the game actually does today: local settings in
  PlayerPrefs, Unity Gaming Services + Vivox during online matches only, and
  the voluntary bug reporter. Update it before shipping a version that sends
  anything new.
- Paths are all relative, so the site also works from a subdirectory or any
  other static host without changes.
