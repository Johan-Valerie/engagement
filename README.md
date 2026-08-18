# Valerie &amp; Johan — Engagement Invitation

Static invitation site for the engagement of **Emanuella Valerie Didy** &amp; **Johan Ganda Wijaya**
— **Saturday, 17 October 2026**, The St. Regis Jakarta.

Live: <https://johangw.github.io/johan-valerie-engagement/>

> Separate project from the wedding invitation
> (`johangw/johan-valerie-invitation`, Jan 2027, Bangkok). Do not merge the two.

## Layout

```
index.html                      one file, ten screens
assets/css/style.css
assets/js/main.js               API_URL lives at the top
assets/img|video|audio/
google-apps-script/Code.gs      RSVP backend (paste into the Sheet)
```

Screen order: **Intro → Cover → Hero → Bride → Groom → Events → Love Story →
Dress Code → RSVP → Wishes → Gallery → Closing.**

## Guest links

```
https://johangw.github.io/johan-valerie-engagement/?to=Mr.%20Budi%20%26%20Mrs.%20Sari&max=2
```

- `to`  — greeting name on the cover; also locks the RSVP name field and becomes the sheet key
- `max` — caps the guest-count dropdown

The `Guests` tab of the Sheet builds these links for you: type a name and a seat
count, and the link appears in column D.

## RSVP backend

Google Sheet **"Johan &amp; Valerie Engagement RSVP"** (its own sheet, not the wedding one).

1. Extensions → Apps Script → paste `google-apps-script/Code.gs` → Save
2. Run `setup()` once, grant permissions
3. Deploy → New deployment → Web app · Execute as **Me** · Access **Anyone**
4. Paste the `/exec` URL into `assets/js/main.js` → `const API_URL = '…'`

Tabs: `RSVP` (responses, one row per guest key, `Approved` checkbox gates the
wishes wall) · `Guests` (control panel + link factory + open tracking) ·
`Dashboard` (counts).

After adding guest rows, run `refreshLinks()` to extend the formulas.
Editing `doGet`/`doPost` requires **Deploy → Manage deployments → New version** —
saving alone does not update the live web app.

## Still to fill in

Search the HTML for `data-fill` — every remaining placeholder is tagged:

| Tag | What |
|---|---|
| `story-1` / `story-2` / `story-3` | Love-story chapter copy (draft in place, keep or rewrite) |

Filled in already: parents' names both sides, and Caroline Astor Ballroom for
both events. Instagram links were removed at the couple's request — the bride
and groom pages end on the parents' line.

Also worth confirming: the dress-code swatch hexes in `style.css` (`.dc-swatches`)
and the Google Maps links, currently a generic search URL rather than a pinned
`maps.app.goo.gl` short link.

## Media notes

- Cover/hero video ships as **two encodes** — `cover-portrait.mp4` (9:16, phones)
  and `cover-landscape.mp4` (16:9, desktop), switched by `<source media>`.
- Gallery photos are reused from the wedding shoot.
- `dress-code.png` had a checkerboard baked into its pixels in the original file;
  the version here has been keyed to real transparency.
- Fonts are Google-hosted stand-ins for the reference's commercial faces:
  Playfair Display (display), Pinyon Script (script), Poppins (UI), Cormorant.
- **Milton One Bold** is self-hosted in `assets/fonts/` — it is not a Google
  Font. Used only for "Valerie", "Johan" and the ampersand on the landing page.
  The vendor ships it as its own family at weight class 400, so `@font-face`
  remaps it to CSS `700`; ask for `font-weight:700` to get the real outlines.
  Licence: free for **personal use** (Youssef Habchi). A private wedding
  invitation is personal use; if this is ever put to commercial use, buy a
  licence from the designer first.

Full design spec: `../ENGAGEMENT-SPEC.md`
