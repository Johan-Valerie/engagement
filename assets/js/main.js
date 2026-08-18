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
  startMusic();
  armReveals();
  $('#music-toggle').classList.add('show');
  $('#nav-toggle').classList.add('show');
  trackOpen();

  setTimeout(() => {
    MAIN.style.scrollSnapType = 'y mandatory';
  }, 600);
});

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
  /* duplicated once so the -50% translate loops seamlessly */
  el.innerHTML = [...list, ...list]
    .map(src => `<img src="${src}" alt="" loading="lazy" data-src="${src}">`).join('');
}
fillRow($('#row-a'), rowA);
fillRow($('#row-b'), rowB);

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
$$('.marquee').forEach(m => m.addEventListener('click', e => {
  if (e.target.tagName === 'IMG') openLightbox(e.target.dataset.src);
}));
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

/* ═══════════ 7 · RSVP ═══════════ */

const form     = $('#rsvp-form');
const nameIn   = $('#f-name');
const paxField = $('#pax-field');
const paxSel   = $('#f-pax');
const note     = $('#form-note');
let   attending = '';

if (GUEST) { nameIn.value = GUEST; nameIn.readOnly = true; }

for (let i = 1; i <= MAX_PAX; i++) {
  paxSel.insertAdjacentHTML('beforeend', `<option value="${i}">${i}</option>`);
}
paxSel.value = String(MAX_PAX);

$$('#f-attend .toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('#f-attend .toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    attending = btn.dataset.value;
    paxField.hidden = attending !== 'Attend';
  });
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  note.classList.remove('err');

  if (!nameIn.value.trim()) { note.textContent = 'Please fill in your name.'; note.classList.add('err'); return; }
  if (!attending)           { note.textContent = 'Please choose whether you can attend.'; note.classList.add('err'); return; }
  if (!API_URL)             { note.textContent = 'RSVP is not open yet — please check back soon.'; note.classList.add('err'); return; }

  const btn = $('#rsvp-submit');
  btn.disabled = true;
  note.textContent = 'Sending…';

  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action:    'rsvp',
        key:       GUEST || nameIn.value.trim(),
        name:      nameIn.value.trim(),
        attending,
        pax:       attending === 'Attend' ? paxSel.value : 0,
        wishes:    $('#f-wishes').value.trim()
      })
    });
    form.innerHTML =
      '<p class="lede" style="text-align:center">Thank you — your response has been recorded.' +
      '<br>We can\'t wait to celebrate with you.</p>';
    setTimeout(loadWishes, 1200);
  } catch (err) {
    note.textContent = 'Something went wrong. Please try again.';
    note.classList.add('err');
    btn.disabled = false;
  }
});

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
