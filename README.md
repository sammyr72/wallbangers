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

## The pachinko balls

One blue racquetball is served in every second from a random angle just off
the edge of the viewport, arcing up toward the top third of whatever is on
screen, then falling back through the content boxes and bouncing off them like
pachinko pegs. It's a single fixed canvas (`#pachinko`) painted over the
sections but under the nav, and it never takes pointer events.

The launch is a real ballistic solve, not a fixed impulse: given the spawn
point, a target and a flight time, the velocity that connects them falls out of
the projectile equations. That's what makes a ball spawned low on the screen
leave faster — it has further to climb in the same time — with no special
casing. Measured: bottom-edge spawns leave at ~16.9 px/frame vs ~15.8 for
side spawns, and shots land within ~43px of their target.

Balls live in **document coordinates**, so peg rectangles are scroll-invariant
and only get re-measured on resize/reflow, and balls stay anchored to the page
as you scroll either direction. Anything far enough outside the viewport is
destroyed.

Knobs, all at the top of the pachinko block in `app.js`:

| What | Where | Notes |
|---|---|---|
| Rate | `SPAWN_MS` | 1000 = one ball a second. Settles at **3–5 on screen**. Halve it to roughly double the population. |
| Arc height / speed | `GRAVITY` | 0.155. Lower = floatier and slower; the launch solve compensates automatically so shots still reach the target. |
| Where they aim | `ty` in `launch()` | `H * (0.08 … 0.34)` — the top third of the viewport. |
| Ball size | `R_MIN` / `R_MAX` | 6–10.5 px radius. |
| Bounciness | `RESTITUTION` | 0.62 — racquetballs are lively. |
| What they hit | `PEG_SEL` | Only elements with a visible edge. **Never add a full-bleed selector** (`.courtline`, `.marquee`, `.foot`): something spanning the full width dams the balls, piles them up and starves the rest of the page. |

At this rate the population is a handful, so there's no perf concern and no
adaptive throttling — the sim measured ~0.5 ms/frame at 1000 balls, far more
than this ever puts on screen. `prefers-reduced-motion` disables the whole thing.

## Phones

The layout already reflowed on its own (auto-fit grids plus `clamp()` type), so
the mobile work is a type-and-density pass rather than a second design, in two
blocks at the end of `styles.css` (`max-width:640px` and `380px`):

- display type and the wide letter-spacing come down — desktop tracking shreds
  short lines on a narrow screen;
- section padding tightens, which took the page from 13,430px to 12,374px tall;
- CTAs go full-width and buttons get a 46px minimum height for touch;
- pachinko balls shrink to 72% (`rScale` in `app.js`) — a 9px ball reads far
  bigger on a 390px screen than on a 1440px one.

Below 960px the nav collapses into a hamburger (`#navToggle`). It closes on
link click, on Escape, and if the window is resized back to desktop. The menu
finds its bar with `closest('.nav')` rather than by id, because `privacy.html`
has a permanently-stuck `.nav` that carries no `#nav`.

Verified at 390px: `scrollWidth` 375 against a 390 viewport with no unexpected
overflow on either page.

Note that headless Chrome clamps `--window-size` to a minimum width well above
390, so screenshotting a phone layout directly gives you a desktop render
cropped to 390px and looks alarmingly broken. Render the page inside a 390px
`<iframe>` instead.

## Notes

- Fonts come from Google Fonts (Anton / Barlow / Barlow Condensed). Everything
  else is local, so the site works offline apart from the typefaces.
- The hero racket is inline SVG — a racquetball teardrop head (wide shoulders,
  pointed throat, short handle), not a tennis oval. It lives in `index.html`.
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
