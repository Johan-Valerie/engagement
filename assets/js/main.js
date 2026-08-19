/* ═══════════════════════════════════════════════════════════
   Valerie & Johan — Engagement Invitation
   ═══════════════════════════════════════════════════════════ */

/* Google Apps Script web-app URL (…/exec). Empty = backend not wired yet. */
const API_URL = 'https://script.google.com/macros/s/AKfycby5HHwzTxSv5x0qr-HreHwcgRsov4CWUQgCo_a8RzCdftUt63Der-G85XkMsWPVuwiU9w/exec';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const params    = new URLSearchParams(location.search);
const GUEST     = (params.get('to') || '').trim();
const MAX_PAX   = Math.max(1, parseInt(params.get('max'), 10) || 2);
/* Tea Pai is invitation-by-invitation: the Sheet only appends &teapai=1 to
   the link when that row is ticked, so the card is hidden unless asked for. */
const TEA_PAI   = params.get('teapai') === '1';

/* ═══════════ 1 · INTRO / PRELOADER ═══════════ */

/* #main is the one scroller — the document itself never moves, so nothing
   but the dark canvas can show behind Safari's bottom bar. Locked until
   OPEN INVITATION. */
const MAIN = $('#main');
function disableScrolling () { MAIN.style.overflowY = 'hidden'; }
function enableScrolling ()  { MAIN.style.overflowY = 'auto'; }
disableScrolling();

const hidePreloader = () => {
  const p = $('#preloader');
  if (!p) return;
  p.style.transition = 'opacity .5s ease';
  p.style.opacity = '0';
  setTimeout(() => { p.remove(); }, 500);   /* scroll stays locked until OPEN INVITATION */
};

const forceHide = setTimeout(hidePreloader, 10000);          // safety net
/* Dismiss exactly 1s after the last beat lands. Anchored to the name's own
   animationend (~5.6s), not window load — waiting for load made the hold
   stretch by however long the media took. */
$$('.intro-name').pop().addEventListener('animationend', () => {
  setTimeout(() => { clearTimeout(forceHide); hidePreloader(); }, 1000);
}, { once: true });

/* refreshing always returns to the cover */
history.scrollRestoration = 'manual';
window.addEventListener('beforeunload', () => window.scrollTo(0, 0));

/* ═══════════ 2 · COVER ═══════════ */

if (GUEST) $('#guest-name').textContent = GUEST;   // cover

/* ── intro greeting ──────────────────────────────────────────────
   The Sheet builds a couple's key as "Name & Companion", so split on
   " & " and give each name its own line with the ampersand between.
   Names carrying titles and suffixes get long, so each line is shrunk
   to fit the block, and only wraps if it still will not fit.        */
function autoFit (node, container, maxPx = 14, minPx = 8.5) {
  node.style.whiteSpace = 'nowrap';
  let size = maxPx;
  node.style.fontSize = size + 'px';
  node.style.letterSpacing = '3px';
  const avail = container.clientWidth;
  while (size > minPx && node.scrollWidth > avail) {
    size -= 0.5;
    node.style.fontSize = size + 'px';
    node.style.letterSpacing = (3 * size / maxPx).toFixed(2) + 'px';
  }
  if (node.scrollWidth > avail) node.style.whiteSpace = 'normal';   // last resort
}

function renderIntroGuest () {
  const el = $('#intro-guest');
  if (!el) return;
  const parts = (GUEST || 'Guest').split(/\s+&\s+/).filter(Boolean);

  el.textContent = '';
  parts.forEach((part, i) => {
    if (i) {
      const amp = document.createElement('span');
      amp.className = 'gamp';
      amp.textContent = '&';
      el.append(amp);
    }
    const n = document.createElement('span');
    n.className = 'gname';
    n.textContent = part;            // textContent, so no escaping needed
    el.append(n);
  });

  const fit = () => $$('.gname', el).forEach(n => autoFit(n, el));
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  addEventListener('resize', fit);
}
renderIntroGuest();

$('#open-invitation').addEventListener('click', () => {
  /* the wedding's open sequence: snap off, unlock, glide to the hero,
     snap on 600ms later — applied to the #main scroller */
  MAIN.style.scrollSnapType = 'none';
  const cover = $('#cover-section');
  cover.classList.add('hidden');
  setTimeout(() => { cover.style.display = 'none'; }, 1000);

  enableScrolling();
  MAIN.scrollTop = 0;
  primeVideo();          /* no-op if it already started during the intro */
  loadPagePhotos();      /* ditto — guarantees pages 2+ have their photos */
  startMusic();
  armReveals();
  $('#music-toggle').classList.add('show');
  $('#nav-toggle').classList.add('show');
  trackOpen();

  setTimeout(() => {
    MAIN.style.scrollSnapType = 'y mandatory';
  }, 600);
});

/* The background video is 2.2MB and nobody can see it until OPEN
   INVITATION is pressed, which cannot happen before the intro ends ~6.6s
   in. Left on preload="auto" it started immediately and swallowed most of
   the bandwidth, so the cover photo — the first thing anyone actually
   looks at — landed seconds late. It now waits for the cover photo to
   arrive and then buffers through the rest of the intro, which is dead
   airtime anyway. */
const bgVideo = $('#bg-video');
function primeVideo () {
  if (!bgVideo || bgVideo.dataset.primed) return;
  bgVideo.dataset.primed = '1';
  bgVideo.preload = 'auto';
  bgVideo.load();
  bgVideo.play().catch(() => {});   /* muted playback; a gesture retries below */
}
/* The bride, groom and closing photos sit behind the cover too. Marking
   them loading="lazy" was not enough — they are only one screen down, so
   the browser fetched them at once anyway and they beat the cover photo
   to the wire. Holding their src back puts them last in the queue, where
   they belong: nobody reaches page 2 before the intro is over. */
function loadPagePhotos () {
  $$('img[data-src]').forEach(img => {
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  });
}

const coverPhoto = $('#cover-bg');
function afterCover () {
  primeVideo();
  /* the video gets a head start; the page photos follow it */
  if (bgVideo) bgVideo.addEventListener('loadeddata', loadPagePhotos, { once: true });
  setTimeout(loadPagePhotos, 2500);
}
if (coverPhoto && coverPhoto.complete) afterCover();
else if (coverPhoto) coverPhoto.addEventListener('load', afterCover, { once: true });
setTimeout(afterCover, 3500);       /* safety net if the photo errors or stalls */

/* background video: iOS/Android refuse autoplay until a gesture */
const kickVideos = () => $$('video').forEach(v => { if (v.paused) v.play().catch(() => {}); });
document.body.addEventListener('click', kickVideos, { once: true });
document.body.addEventListener('touchstart', kickVideos, { once: true });

/* ═══════════ 3 · MUSIC ═══════════ */

const music  = $('#music');
const mBtn   = $('#music-toggle');

function startMusic () {
  music.volume = 0.55;
  music.play().catch(() => mBtn.classList.add('paused'));
}
mBtn.addEventListener('click', () => {
  if (music.paused) { music.play().catch(() => {}); mBtn.classList.remove('paused'); }
  else              { music.pause();                mBtn.classList.add('paused'); }
});

/* ═══════════ 4 · NAV ═══════════ */

const navBtn  = $('#nav-toggle');
const navMenu = $('#nav-menu');

navBtn.addEventListener('click', () => {
  navBtn.classList.toggle('open');
  navMenu.classList.toggle('open');
});

let navSettleWatch;
$$('.nav-menu a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = $(a.getAttribute('href'));
    navBtn.classList.remove('open');
    navMenu.classList.remove('open');
    if (!target) return;

    /* the wedding's jump — pause snap, glide, re-arm — but re-arm only on
       ARRIVAL, not on a timer: a fixed timer can fire mid-glide on long
       jumps and mandatory snap then drags the scroll back. If the glide
       stalls short (browser smooth-scroll tails can), resume it. */
    MAIN.style.scrollSnapType = 'none';
    target.scrollIntoView({ behavior: 'smooth' });
    clearInterval(navSettleWatch);
    let last = -1, still = 0;
    const t0 = Date.now();
    navSettleWatch = setInterval(() => {
      const goal = target.offsetTop;
      const y = MAIN.scrollTop;
      const stalled = y === last && ++still >= 3;
      if (y !== last) { still = 0; last = y; }
      if (Math.abs(y - goal) < 2 || Date.now() - t0 > 4000) {
        clearInterval(navSettleWatch);
        MAIN.scrollTo(0, goal);
        MAIN.style.scrollSnapType = 'y mandatory';
      } else if (stalled) {
        still = 0;
        MAIN.scrollTo({ top: goal, behavior: 'smooth' });
      }
    }, 100);
  });
});

/* ═══════════ 5 · SCROLL REVEALS ═══════════ */

/* Elements carry .reanimate + a direction (.fade/.up/.left/.right) + a
   .delayNms stagger. Adding .in-view plays the reveal and removing it
   rewinds, so a page replays its stagger every time you come back to it.

   Visibility is measured straight from #main's box on each scroll frame,
   NOT left to an IntersectionObserver. Since the pages moved inside the
   fixed #main scroller, an observer rooted at the viewport misreports
   elements in a fixed subtree on iOS Safari: it called all 37 visible the
   moment the invitation opened, so every fade ran off-screen and each page
   was already solid by the time you scrolled to it — no animation at all.
   Element rects always reflect what is really painted, so this cannot
   disagree with what the eye sees. 37 elements, throttled to one pass per
   frame: cheaper than it looks. */
const reveals = [];

function syncReveals () {
  const box = MAIN.getBoundingClientRect();
  const top = box.top + 10, bottom = box.bottom - 10;   /* the old -10px margin */
  reveals.forEach(el => {
    const r = el.getBoundingClientRect();
    el.classList.toggle('in-view', r.top < bottom && r.bottom > top);
  });
}

let revealTick = false;
function queueReveals () {
  if (revealTick) return;
  revealTick = true;
  requestAnimationFrame(() => { revealTick = false; syncReveals(); });
}

/* Armed on open, not at load: the hero sits behind the cover, and marking
   it visible early would burn its fade where nobody can see it. */
function armReveals () {
  reveals.push(...$$('.reanimate'));
  syncReveals();
  MAIN.addEventListener('scroll', queueReveals, { passive: true });
  addEventListener('resize', queueReveals);
}

/* ═══════════ 6 · GALLERY ═══════════ */

const PHOTOS = Array.from({ length: 14 }, (_, i) => `assets/img/g${String(i + 1).padStart(2, '0')}.jpg`);
const rowA = PHOTOS.slice(0, 7);
const rowB = PHOTOS.slice(7);

function fillRow (el, list) {
  /* the list is laid down twice so the wrap at the halfway mark is invisible */
  el.innerHTML = [...list, ...list]
    .map(src => `<img src="${src}" alt="" loading="lazy" data-src="${src}">`).join('');
}
fillRow($('#row-a'), rowA);
fillRow($('#row-b'), rowB);

/* Each row drifts on its own by nudging scrollLeft. Driving the real
   scroll position (instead of animating a transform inside a clipped box)
   is what makes the gallery usable on a phone: the strip is a native
   scroller, so a swipe takes over instantly, and the drift resumes a
   moment after the finger leaves. Reduce Motion stops the drift but
   leaves the swiping. */
function driftRow (row, dir, pxPerSecond) {
  const halfway  = () => row.scrollWidth / 2;
  const realMouse = matchMedia('(hover: hover) and (pointer: fine)');
  let hovering = false, resumeAt = 0, last = 0;
  let pos = 0;   /* the drift's own position, kept as a float — see tick() */

  /* the right-hand row travels backwards, so it starts on the second copy */
  const seed = () => {
    if (!row.scrollWidth) return;
    pos = dir === 'right' ? halfway() : 0;
    row.scrollLeft = pos;
  };
  seed();
  addEventListener('load', seed, { once: true });

  const handOver = () => { resumeAt = performance.now() + 1600; };
  ['touchstart', 'touchmove', 'touchend', 'wheel', 'pointerdown']
    .forEach(ev => row.addEventListener(ev, handOver, { passive: true }));
  /* Hover-pause only where a real pointer exists. iOS fires a synthetic
     mouseenter when you tap and never sends the matching mouseleave, so
     on a phone this used to latch and stop the drift for good after the
     first swipe. */
  if (realMouse.matches) {
    row.addEventListener('mouseenter', () => { hovering = true; });
    row.addEventListener('mouseleave', () => { hovering = false; });
  }

  const tick = now => {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;   /* cap after a stall */
    last = now;
    const half = halfway();
    /* Deliberately NOT gated on prefers-reduced-motion: the couple asked
       for the strips to keep moving, and a slow sideways photo drift is
       not the kind of motion that setting exists to suppress. The page
       reveals still honour it (they drop their travel and only fade). */
    const free = !hovering && now >= resumeAt && !document.hidden;

    if (half > 0 && free) {
      /* The position is accumulated here as a float and only then written
         out. Reading scrollLeft back each frame instead loses the
         sub-pixel remainder to the browser's rounding, so a drift this
         slow (under half a pixel per frame) rounds away to nothing and
         the strip sits perfectly still. */
      pos += (dir === 'left' ? 1 : -1) * pxPerSecond * dt;
      /* wrap on the side this row travels towards — wrapping both ends
         would bounce the strip between 0 and the halfway mark forever */
      if (dir === 'left') { if (pos >= half) pos -= half; }
      else                { if (pos <= 0)    pos += half; }
      row.scrollLeft = pos;
    } else {
      pos = row.scrollLeft;   /* a finger is in charge — follow it */
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
/* the .marquee wrapper is the scroller; #row-* is the track inside it */
driftRow($('#row-a').closest('.marquee'), 'left', 26);
driftRow($('#row-b').closest('.marquee'), 'right', 22);

const lb     = $('#lightbox');
const lbImg  = $('#lb-img');
let   lbList = [], lbIdx = 0;

function openLightbox (src) {
  lbList = PHOTOS;
  lbIdx  = Math.max(0, lbList.indexOf(src));
  lbImg.src = lbList[lbIdx];
  lb.hidden = false;
}
function stepLightbox (d) {
  lbIdx = (lbIdx + d + lbList.length) % lbList.length;
  lbImg.src = lbList[lbIdx];
}
/* Tap opens the slideshow, swipe just scrolls. The listener goes on each
   image rather than the row: iOS delivers taps to the element itself far
   more reliably than to a delegating parent, and a swipe that happens to
   end on a photo must not open anything. */
$$('.marquee').forEach(row => {
  let sx = 0, sy = 0, swiped = false;
  row.addEventListener('touchstart', e => {
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; swiped = false;
  }, { passive: true });
  row.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) swiped = true;
  }, { passive: true });

  $$('img', row).forEach(img => img.addEventListener('click', () => {
    if (swiped) { swiped = false; return; }
    openLightbox(img.dataset.src);
  }));
});
$('#lb-close').addEventListener('click', () => { lb.hidden = true; });
$('#lb-prev').addEventListener('click', () => stepLightbox(-1));
$('#lb-next').addEventListener('click', () => stepLightbox(1));
lb.addEventListener('click', e => { if (e.target === lb) lb.hidden = true; });
document.addEventListener('keydown', e => {
  if (lb.hidden) return;
  if (e.key === 'Escape')     lb.hidden = true;
  if (e.key === 'ArrowLeft')  stepLightbox(-1);
  if (e.key === 'ArrowRight') stepLightbox(1);
});

/* ═══════════ 6b · TEA PAI ═══════════ */

if (!TEA_PAI) {
  const card = $('#teapai-card');
  const rule = $('#teapai-divider');
  if (card) card.remove();
  if (rule) rule.remove();
  /* Reception is then the only card on the page, so it should not wait its
     turn behind two reveals that no longer exist. */
  const reception = $('#reception-card');
  if (reception) reception.classList.replace('delay600ms', 'delay200ms');
}

/* ═══════════ 7 · RSVP ═══════════ */

/* Two steps in one section:
     attendance ─┬─ Not attend ─→ wishes ─→ SUBMIT
                 └─ Attend ─────→ number of guests ─→ wishes ─→ NEXT
                                  ─→ step 2: one name field per guest ─→ SUBMIT
   There is no name field in the normal flow: the invitation name from ?to= is
   the identity, and it is what appears on the wish. A visitor who arrives
   without ?to= (a forwarded link, or us testing) still gets one, or they could
   not be recorded at all. */

const form      = $('#rsvp-form');
const nameField = $('#name-field');
const nameIn    = $('#f-name');
const paxField  = $('#pax-field');
const paxSel    = $('#f-pax');
const wishField = $('#wishes-field');
const step1     = $('#rsvp-step1');
const step2     = $('#rsvp-step2');
const nextBtn   = $('#rsvp-next');
const backBtn   = $('#rsvp-back');
const submit1   = $('#rsvp-submit');
const submit2   = $('#rsvp-submit2');
const guestBox  = $('#guest-fields');
const rsvpTitle = $('#rsvp-title');
const rsvpLede  = $('#rsvp-lede');
const answered  = $('#rsvp-answered');
const answeredNote = $('#answered-note');
const answerList= $('#answered-list');
const editBtn   = $('#rsvp-edit');
const note      = $('#form-note');
let   attending = '';
let   reply     = null;    // this invitation's stored answer, once we know it
let   savedNames = [];     // guest names it was submitted with
let   touched   = false;   // has anyone started filling the form in?

const TITLE_STEP1 = rsvpTitle.textContent;
const LEDE_STEP1  = rsvpLede.textContent;
const LEDE_STEP2  = 'Please write the name of everyone joining us, as you would like it to be read on the day.';

if (!GUEST) nameField.hidden = false;
const who = () => GUEST || nameIn.value.trim();

for (let i = 1; i <= MAX_PAX; i++) {
  paxSel.insertAdjacentHTML('beforeend', `<option value="${i}">${i}</option>`);
}
paxSel.value = String(MAX_PAX);

function fail (msg) {
  note.textContent = msg;
  note.classList.add('err');
}

function showStep (n) {
  step1.hidden = n !== 1;
  step2.hidden = n !== 2;
  rsvpTitle.textContent = n === 1 ? TITLE_STEP1 : 'WHO IS JOINING?';
  rsvpLede.textContent  = n === 1 ? LEDE_STEP1 : LEDE_STEP2;
  note.textContent = '';
  note.classList.remove('err');
  const col = $('.rsvp-inner');
  if (col) col.scrollTop = 0;
}

/* Rebuilt whenever the count changes; anything already typed is carried over,
   and the invitation name seeds the first fields ("A & B" → two guests). */
function buildGuestFields (n) {
  const typed = $$('.rsvp-guest', guestBox).map(i => i.value);
  const seed  = (GUEST || '').split(/\s+&\s+/).map(s => s.trim()).filter(Boolean);
  guestBox.innerHTML = '';
  for (let i = 0; i < n; i++) {
    /* A field already on screen keeps exactly what is in it, blank included —
       only positions that did not exist yet fall back to a previous answer,
       then to the invitation name. */
    const val = typed[i] !== undefined ? typed[i] : (savedNames[i] || seed[i] || '');
    guestBox.insertAdjacentHTML('beforeend', `
      <label class="field">
        <span class="field-label">GUEST ${i + 1}</span>
        <input type="text" class="rsvp-guest" placeholder="Full name" value="${esc(val)}">
      </label>`);
  }
}

$$('#f-attend .toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('#f-attend .toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    attending = btn.dataset.value;
    touched = true;

    const going = attending === 'Attend';
    paxField.hidden  = !going;
    wishField.hidden = false;
    nextBtn.hidden   = !going;
    submit1.hidden   = going;
    note.textContent = '';
    note.classList.remove('err');
  });
});

nextBtn.addEventListener('click', () => {
  note.classList.remove('err');
  if (!who()) { fail('Please fill in your name.'); return; }
  buildGuestFields(Number(paxSel.value) || 1);
  showStep(2);
});

backBtn.addEventListener('click', () => showStep(1));

form.addEventListener('submit', async e => {
  e.preventDefault();
  note.classList.remove('err');

  const going = attending === 'Attend';

  if (!who())     { fail('Please fill in your name.'); return; }
  if (!attending) { fail('Please choose whether you can attend.'); return; }
  if (!API_URL)   { fail('RSVP is not open yet — please check back soon.'); return; }

  let names = [];
  if (going) {
    names = $$('.rsvp-guest', guestBox).map(i => i.value.trim());
    if (!names.length)          { fail('Please tell us who is joining.'); return; }
    if (names.some(n => !n))    { fail('Please fill in every guest name.'); return; }
  }

  const btn = going ? submit2 : submit1;
  btn.disabled = true;
  note.textContent = 'Sending…';

  try {
    /* keepalive lets the request finish even if the page is closed a moment
       later — the confirmation no longer waits for it, so it has to survive
       on its own. */
    const sent = fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action:    'rsvp',
        key:       who(),
        name:      who(),
        attending,
        pax:       going ? names.length : 0,
        guests:    names,
        wishes:    $('#f-wishes').value.trim()
      })
    });

    /* The reply is opaque — mode:'no-cors' means we cannot read a status, a
       body, or anything else from it, so waiting the full round trip tells us
       nothing beyond "it left the device". Apps Script takes 3-10s to answer
       even a read-only request, and that whole wait was being spent in front of
       the guest. Wait only long enough for an outright network failure to
       surface, then confirm. */
    let offline = false;
    await Promise.race([
      sent.catch(() => { offline = true; }),
      new Promise(r => setTimeout(r, 1200))
    ]);
    if (offline) throw new Error('unreachable');

    /* Still watch it: if it fails after we have said thank you, say so. */
    sent.catch(() => {
      answeredNote.textContent = 'We could not reach the server — please open this link again later and check your response was saved.';
      answeredNote.classList.add('err');
    });

    savedNames = names;
    showAnswered({ attending, pax: going ? names.length : 0,
                   guests: names.join(', '), wishes: $('#f-wishes').value.trim() });
    btn.disabled = false;
    setTimeout(loadWishes, 1200);
  } catch (err) {
    note.textContent = 'Something went wrong. Please try again.';
    note.classList.add('err');
    btn.disabled = false;
  }
});

/* ── already answered ──────────────────────────────────────────
   The Sheet upserts on the invitation key, so an edit overwrites the same row
   rather than adding a second one — which means "edit" is just the same form
   again, pre-filled, and the same POST. */

function answerRow (label, value) {
  return `<div class="answered-row"><dt>${label}</dt><dd>${esc(value)}</dd></div>`;
}

function showAnswered (d) {
  reply = d;
  answeredNote.textContent = '';
  answeredNote.classList.remove('err');
  const going = d.attending === 'Attend';

  form.hidden = true;
  answered.hidden = false;
  rsvpTitle.textContent = 'THANK YOU';
  rsvpLede.textContent = going
    ? 'Your response has been recorded. We can’t wait to celebrate with you.'
    : 'Thank you for letting us know — you will be dearly missed.';

  let html = answerRow('ATTENDANCE', going ? 'Attending' : 'Not attending');
  if (going) {
    html += answerRow('GUESTS', String(d.pax || 0));
    if (d.guests) html += answerRow('NAMES', String(d.guests).split(',').map(n => n.trim()).join(', '));
  }
  if (d.wishes) html += answerRow('WISHES', d.wishes);
  answerList.innerHTML = html;
}

function showForm () {
  answered.hidden = true;
  form.hidden = false;

  /* The form is a reveal target. While it was hidden its rect measured 0x0, so
     syncReveals stripped .in-view and left it laid out but fully transparent —
     and nothing re-measures until the next scroll, which is why the fields only
     turned up after visiting another page and coming back. Put it back here,
     and drop the entrance stagger so an edit opens at once rather than 600ms
     later. */
  form.classList.remove('delay600ms');
  form.classList.add('in-view');
  queueReveals();
}

editBtn.addEventListener('click', () => {
  const d = reply || {};
  const going = d.attending === 'Attend';

  savedNames = String(d.guests || '').split(',').map(n => n.trim()).filter(Boolean);
  const pick = $(`#f-attend [data-value="${going ? 'Attend' : 'Not attend'}"]`);
  if (pick) pick.click();                       // reuses the show/hide logic
  if (going) paxSel.value = String(Math.min(Math.max(Number(d.pax) || 1, 1), MAX_PAX));
  $('#f-wishes').value = d.wishes || '';
  guestBox.innerHTML = '';                      // rebuilt from savedNames on NEXT

  showForm();
  showStep(1);
});

/* On a return visit, ask the Sheet what this invitation already said. Anyone
   who has started answering in the meantime keeps their half-filled form. */
async function loadReply () {
  if (!API_URL || !GUEST) return;
  try {
    const res  = await fetch(`${API_URL}?action=status&key=${encodeURIComponent(GUEST)}`);
    const data = await res.json();
    if (data && data.found && !touched) {
      savedNames = String(data.guests || '').split(',').map(n => n.trim()).filter(Boolean);
      showAnswered(data);
    }
  } catch (err) { /* leave the blank form in place */ }
}
loadReply();

/* ═══════════ 8 · WISHES ═══════════ */

const PER_PAGE = 4;
let wishes = [], page = 0;

function ago (iso) {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  const parts = [];
  let rest = secs;
  for (const [label, size] of units) {
    const n = Math.floor(rest / size);
    if (n > 0) { parts.push(`${n} ${label}${n === 1 ? '' : 's'}`); rest -= n * size; }
    if (parts.length === 2) break;
  }
  return parts.length ? `${parts.join(' ')} ago` : 'just now';
}

function renderWishes () {
  const list  = $('#wishes-list');
  const pager = $('#wishes-pager');

  if (!wishes.length) {
    list.innerHTML = '<p class="wishes-empty">Be the first to leave a wish.</p>';
    pager.hidden = true;
    return;
  }

  const pages = Math.ceil(wishes.length / PER_PAGE);
  page = Math.min(page, pages - 1);

  list.innerHTML = wishes.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map(w => `
    <div class="wish">
      <p class="wish-name">${esc(w.name)}</p>
      <p class="wish-msg">${esc(w.wishes)}</p>
      <p class="wish-time">${ago(w.time)}</p>
    </div>`).join('');

  pager.hidden = pages < 2;
  $('#w-count').textContent = `${page + 1} / ${pages}`;
  $('#w-prev').disabled = page === 0;
  $('#w-next').disabled = page >= pages - 1;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

$('#w-prev').addEventListener('click', () => { page--; renderWishes(); });
$('#w-next').addEventListener('click', () => { page++; renderWishes(); });

async function loadWishes () {
  if (!API_URL) return;
  try {
    const res = await fetch(`${API_URL}?action=wishes`);
    const data = await res.json();
    wishes = Array.isArray(data) ? data : (data.wishes || []);
    renderWishes();
  } catch (err) { /* leave the empty state in place */ }
}
loadWishes();

/* ═══════════ 9 · OPEN TRACKING ═══════════ */

function trackOpen () {
  if (!API_URL || !GUEST) return;
  fetch(API_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'open', key: GUEST })
  }).catch(() => {});
}

/* ═══════════ 10 · WEDDING GIFT ═══════════ */

const giftBox = $('#gift-container');

if (giftBox) {
  const toggleGift = () => giftBox.classList.toggle('active');
  $('#gift-open').addEventListener('click', toggleGift);
  $('#gift-close').addEventListener('click', toggleGift);

  /* navigator.clipboard needs a secure context; the fallback keeps the button
     working anywhere else, including older iOS. */
  function copyText (text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;left:-9999px;opacity:0';
    document.body.append(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    try { document.execCommand('copy'); } finally { ta.remove(); }
    return Promise.resolve();
  }

  $$('.gift-copy-btn').forEach(btn => {
    let revert;
    btn.addEventListener('click', async () => {
      try { await copyText(btn.dataset.copy); } catch (err) { /* nothing to show */ }
      btn.classList.add('copied');
      clearTimeout(revert);
      revert = setTimeout(() => btn.classList.remove('copied'), 1600);
    });
  });
}
