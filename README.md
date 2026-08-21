# Valerie &amp; Johan — Engagement Invitation

Static invitation site for the engagement of **Emanuella Valerie Didy** &amp; **Johan Ganda Wijaya**
— **Saturday, 17 October 2026**, The St. Regis Jakarta.

Live: <https://johan-valerie.github.io/engagement/>

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

Screen order: **Intro → Cover → Hero → Bride → Groom → Events →
Dress Code → RSVP → Wishes → Gallery → Closing.**

One `<video>` runs fixed behind every page (`#bg-video`); bride, groom and
closing cover it with their own photos, everything else shows it through a
scrim. The love-story page and the wedding-gift page were both removed at the
couple's request — the gift page's markup, CSS, JS and `bca.png` all went with
it, so nothing is left to re-enable.

## Guest links

A link is one number and nothing else:

```
https://johan-valerie.github.io/engagement/?i=712345
```

`7` is the invitation number; `12345…` — always the **last six digits** — is
that row's `Code`. Only the code identifies anything. The leading digits are
there so the link means something to us, and are deliberately not checked: the
invitation number is a formula on row position, so deleting a row renumbers
everything below it, and links already sent have to keep working.

Nothing about the guest is in the URL. That is not only so it reads less like a
dossier — the old `?to=…&max=2&teapai=1` form was **editable**. A guest could
type `max=2` up to `max=8`, or append `&teapai=1` and see Tea Pai details they
were not invited to. Seats and flags now come from the Sheet, where the guest
cannot reach them.

**A consequence worth knowing: ticking a flag now works retroactively.** The
site asks the Sheet for the name, seat count, `Tea Pai` and `Pentamoo` every
time a link is opened, so ticking a box after the link has gone out simply
works the next time that guest opens it — no re-send, no `refreshLinks()`. That
was not true of the old links, where the flag was baked into the URL. (A guest
who already opened it once holds a cached copy; the site notices the mismatch
and reloads itself once, so they still land on the right version.)

`refreshLinks()` is now only needed after **adding rows** — it fills in each new
row's `Code` and extends the link formula down.

The `Invitation` tab builds the links: type a name and a seat count, tick
`Tea Pai` and/or `Pentamoo` as they apply, and the link appears in column H.
The `Code` in column G is generated once and written as a value, never a
formula — a code that recalculated would kill every link already sent.

## RSVP flow

Attendance first. **Not attending** → wishes → submit. **Attending** → number of
guests → wishes → **next** → one field per guest name → submit. Guests never
type their own name: the wish is signed with the invitation name the link resolved to,
and the names collected on the second step go to the `Guest List` tab.

A `Pentamoo` invitation skips all of that and sees a single wishes field. It
still submits through the same POST and gets the same thank-you panel and EDIT
RESPONSE button; only the attendance question and what it gates are absent. A
wish is required there, since it is the entire submission.

Submitting does **not** wait for the backend to reply. The request goes out with
`mode: 'no-cors'`, so its response is opaque — there is no status or body to
read, and Apps Script takes 3–10s to answer even a read-only request. The page
waits only long enough for an outright network failure to surface (~1.2s), then
confirms; `keepalive` lets the request finish even if the page is closed, and a
later failure is reported on the panel.

Once an invitation has answered, its link opens on a **thank-you panel**
summarising the response, with an **EDIT RESPONSE** button that reopens the form
pre-filled. The page asks `doGet?action=status&key=…` on load to find this out,
and an edit re-POSTs under the same key — which the Sheet upserts, so it
corrects the existing row instead of adding a second one. Anyone who has already
started filling the form in keeps what they typed if the lookup lands late.

## RSVP backend

Google Sheet **"Johan &amp; Valerie Engagement RSVP"** (its own sheet, not the wedding one).

1. Extensions → Apps Script → paste `google-apps-script/Code.gs` → Save
2. Run `setup()` once, grant permissions
3. Deploy → New deployment → Web app · Execute as **Me** · Access **Anyone**
4. Paste the `/exec` URL into `assets/js/main.js` → `const API_URL = '…'`

Tabs: `RSVP` (responses, one row per invitation, `Approved` checkbox gates the
wishes wall) · `Invitation` (control panel + link factory + open tracking; column
A is the invitation number, filled by formula from the row) · `Guest List` (one
row per confirmed person with the invitation number they belong to — written by
the site, not by hand, and rebuilt for an invitation each time it re-submits) ·
`Dashboard` (counts).

`setup()` is safe to re-run: it migrates every tab by header name, so data
survives a column moving, and it renames an older `Guests` tab to `Invitation`.

Two tickboxes are per invitation: `Tea Pai` (column E) and `Pentamoo`
(column F). Both default to off, so an untouched row produces the ordinary
invitation. Neither is in the link any more — the site reads them from the row
on every open, which is why ticking one takes effect without re-sending
anything. See the Guest links section above for what each changes.

After adding invitation rows, run `refreshLinks()`. It gives each new row a
`Code`, extends the invitation number and link formulas down, and re-reads
every RSVP to rewrite `Status` and `Pax confirmed` — so it also repairs those
if they look blank. Existing codes are never regenerated.

`Status` and `Pax confirmed` are values written by the script, not formulas. They
used to be INDEX/MATCH lookups on the invitation name, which meant the name the
spreadsheet rebuilt and the key the web app stored had to agree on a piece of
text; any drift produced silent blanks. Matching now happens in script, with both
sides through the same `normKey_`.
Editing `doGet`/`doPost` requires **Deploy → Manage deployments → New version** —
saving alone does not update the live web app.

## Still to fill in

None — the love-story page (which held the last `data-fill` placeholders)
has been removed.

Filled in already: parents' names both sides, and Caroline Astor Ballroom for
both events. Instagram links were removed at the couple's request — the bride
and groom pages end on the parents' line.

The dress-code swatches are inline `background` values on the `<i>` elements in
`index.html`, not in the stylesheet. They run brown to taupe and were sampled
from the two illustrations, so changing the artwork means resampling them.

Still worth confirming: the Google Maps links, currently a generic search URL
rather than a pinned `maps.app.goo.gl` short link.

## Media notes

- Cover/hero video ships as **two encodes** — `cover-portrait.mp4` (9:16, phones)
  and `cover-landscape.mp4` (16:9, desktop), switched by `<source media>`.
- Dress code shows two illustrated looks, `dresscode-1..2.webp` (560x840,
  ~79KB each). WebP because these are soft-gradient artwork on transparency:
  a 255-colour PNG palette bands them badly and full-depth PNG is 4x larger.
  The strip is capped at 420px from the tablet breakpoint up: two 2:3 portraits
  across a full desktop column would stand 465px tall and push the swatches and
  caption off a 768px-high screen.
- Gallery photos (`g01`–`g18.webp`) are built by template string in `main.js`,
  not written out in the markup — a plain filename grep will not find them.
  1100px on the long edge: the lightbox opens them at up to 86vh, where the
  old 900px was soft. 18 of them still total 1.65MB, less than the 14 JPEGs
  they replaced. `g01`–`g09` are the top marquee row, `g10`–`g18` the bottom,
  ordered villa → countryside → evening city with three landscapes in each row
  so neither is all portraits. `g18` is also the closing page background.
- The marquee images deliberately carry NO `data-src`. `loadPagePhotos()`
  sweeps every `img[data-src]` on the page and strips the attribute, which used
  to leave the lightbox reading `undefined` and opening photo 1 every time.
- Bride and groom portraits are 1200x1800 (2:3). Their crop is anchored with
  `object-position` so a wide desktop viewport does not cut the faces off;
  phones crop these horizontally, so the vertical anchor has no effect there.
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
