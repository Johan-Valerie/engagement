/**
 * Valerie & Johan — ENGAGEMENT RSVP backend (Google Apps Script)
 * ─────────────────────────────────────────────────────────────
 * Lives inside the "Johan & Valerie Engagement RSVP" Google Sheet.
 * Separate from the wedding sheet — do not point this at that one.
 *
 * SETUP (once):
 *   1. Extensions → Apps Script, paste this file, Save.
 *   2. Run setup() once and grant permissions.
 *   3. Deploy → New deployment → Web app
 *        Execute as:      Me
 *        Who has access:  Anyone
 *   4. Copy the /exec URL into assets/js/main.js  →  const API_URL = '…'
 *
 * Changing doGet/doPost later needs Deploy → Manage deployments →
 * edit → New version. Saving alone does NOT update the live web app.
 *
 * THE THREE TABS
 *   Invitation — one row per invitation (what used to be "Guests"). Column A
 *                is the invitation number, filled by formula from the row, so
 *                it is stable and never needs typing. Ticking "Tea Pai" adds
 *                &teapai=1 to that row's link, and the site shows the Tea Pai
 *                card only when the link carries it — so the tick has to
 *                happen BEFORE that link goes out.
 *   Guest List — one row per confirmed person, carrying the invitation number
 *                they belong to. Written by the site, not by hand: it is
 *                rebuilt for an invitation every time that invitation
 *                re-submits, so it always matches the latest answer.
 *   RSVP       — the raw submissions, one row per invitation, plus the
 *                Approved checkbox that gates a wish onto the site.
 *
 * setup() is safe to re-run. It migrates by HEADER NAME, so a tab that was
 * built by an earlier version of this file keeps its data even though the
 * columns have moved — and it renames an existing "Guests" tab rather than
 * leaving a stale duplicate behind.
 *
 * IF Status / Pax confirmed LOOK EMPTY: run refreshLinks(). It re-reads every
 * RSVP row and rewrites both columns, so anything that was blank fills in.
 * If they are STILL blank afterwards, the response never reached this code —
 * check that Deploy → Manage deployments → edit → New version was done, since
 * an older live deployment writes the RSVP row with different columns.
 */

var RSVP_SHEET  = 'RSVP';
var INV_SHEET   = 'Invitation';
var GLIST_SHEET = 'Guest List';
var DASH_SHEET  = 'Dashboard';
var LEGACY_INV  = 'Guests';          // pre-rename name, migrated on setup()

var SITE_URL = 'https://johangw.github.io/johan-valerie-engagement/';
var TZ       = 'Asia/Jakarta';

/* RSVP columns (1-based) */
var COL = { TIME:1, KEY:2, NAME:3, INVNO:4, ATTENDING:5, PAX:6, GUESTS:7, WISHES:8, APPROVED:9 };
var HEADERS = ['Timestamp','Guest link (key)','Invitation name','Invitation no.',
               'Attending','Pax','Guest names','Wishes','Approved'];

/* Invitation columns (1-based) */
var ICOL = { NO:1, NAME:2, COMPANION:3, SEATS:4, TEAPAI:5, LINK:6, STATUS:7, PAX:8,
             FIRST:9, LAST:10, OPENS:11 };
var IHEADERS = ['Invitation no.','Guest name','Companion name','Max seats','Tea Pai',
                'Personalized link','Status','Pax confirmed',
                'First opened (WIB)','Last opened (WIB)','Opens'];

/* Guest List columns (1-based) */
var GLCOL = { NO:1, GUEST:2, INVNO:3, INVNAME:4, WHEN:5 };
var GLHEADERS = ['No.','Guest name','Invitation no.','Invitation name','Confirmed (WIB)'];

/* ═══════════════ ONE-TIME SETUP ═══════════════ */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);

  setupRsvp_(ss);
  setupInvitation_(ss);
  setupGuestList_(ss);
  setupDashboard_(ss);

  SpreadsheetApp.getUi().alert(
    'Setup complete.\n\n' +
    'Tabs: Invitation (was "Guests", now with an invitation number and a ' +
    'Tea Pai tickbox), Guest List (filled in by the site), RSVP, Dashboard.\n\n' +
    'Tea Pai starts off for every row. Tick the rows that are invited, then ' +
    'run refreshLinks() so their links pick it up.\n\n' +
    'Now Deploy → Manage deployments → edit → New version, so the live web app ' +
    'picks this up.');
}

/** RSVP keeps its rows: they are re-read by header name and re-laid-out. */
function setupRsvp_(ss) {
  var s = ss.getSheetByName(RSVP_SHEET);
  var kept = readByHeader_(s, HEADERS, { 'Invitation name': ['Name'] });

  if (!s) s = ss.insertSheet(RSVP_SHEET);
  s.clear();
  s.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
   .setFontWeight('bold').setBackground('#292929').setFontColor('#ffffff');
  s.setFrozenRows(1);
  s.setColumnWidth(COL.KEY, 200);
  s.setColumnWidth(COL.GUESTS, 260);
  s.setColumnWidth(COL.WISHES, 340);

  if (kept.length) {
    s.getRange(2, 1, kept.length, HEADERS.length).setValues(kept);
    s.getRange(2, COL.APPROVED, kept.length, 1).insertCheckboxes();
  }
}

/** "Guests" becomes "Invitation", gaining a formula-filled number in column A. */
function setupInvitation_(ss) {
  var s = ss.getSheetByName(INV_SHEET);
  var legacy = ss.getSheetByName(LEGACY_INV);

  // An old "Guests" tab is the same data under old headers.
  if (!s && legacy) { legacy.setName(INV_SHEET); s = legacy; legacy = null; }

  var kept = readByHeader_(s, IHEADERS, {
    'Invitation no.': ['No.'],
    'Guest name': ['Guest name', 'Name']
  });
  if (!kept.length && legacy) kept = readByHeader_(legacy, IHEADERS);
  if (legacy) ss.deleteSheet(legacy);

  if (!s) s = ss.insertSheet(INV_SHEET);
  s.clear();
  s.getRange(1, 1, 1, IHEADERS.length).setValues([IHEADERS])
   .setFontWeight('bold').setBackground('#292929').setFontColor('#ffffff');
  s.setFrozenRows(1);
  s.setColumnWidth(ICOL.NO, 110);
  s.setColumnWidth(ICOL.NAME, 210);
  s.setColumnWidth(ICOL.COMPANION, 180);
  s.setColumnWidth(ICOL.TEAPAI, 80);
  s.setColumnWidth(ICOL.LINK, 460);

  // Rows with no guest name are noise from a previous layout.
  kept = kept.filter(function (r) { return String(r[ICOL.NAME - 1]).trim() !== ''; });
  if (kept.length) {
    var out = kept.map(function (r) {
      return ['', r[ICOL.NAME - 1], r[ICOL.COMPANION - 1], r[ICOL.SEATS - 1] || 2,
              r[ICOL.TEAPAI - 1] === true, '', '', '',
              r[ICOL.FIRST - 1], r[ICOL.LAST - 1], r[ICOL.OPENS - 1]];
    });
    s.getRange(2, 1, out.length, IHEADERS.length).setValues(out);
    s.getRange(2, ICOL.TEAPAI, out.length, 1).insertCheckboxes();
  }
  SpreadsheetApp.flush();          // getLastRow() below must see the rows just written
  writeInvitationFormulas_(s);
}

/** Written by the site. Setup only creates it and keeps whatever is there. */
function setupGuestList_(ss) {
  var s = ss.getSheetByName(GLIST_SHEET);
  var kept = readByHeader_(s, GLHEADERS);

  if (!s) s = ss.insertSheet(GLIST_SHEET);
  s.clear();
  s.getRange(1, 1, 1, GLHEADERS.length).setValues([GLHEADERS])
   .setFontWeight('bold').setBackground('#292929').setFontColor('#ffffff');
  s.setFrozenRows(1);
  s.setColumnWidth(GLCOL.NO, 60);
  s.setColumnWidth(GLCOL.GUEST, 230);
  s.setColumnWidth(GLCOL.INVNO, 110);
  s.setColumnWidth(GLCOL.INVNAME, 230);
  s.setColumnWidth(GLCOL.WHEN, 160);

  kept = kept.filter(function (r) { return String(r[GLCOL.GUEST - 1]).trim() !== ''; });
  if (kept.length) s.getRange(2, 1, kept.length, GLHEADERS.length).setValues(kept);
  renumberGuestList_(s);
}

function setupDashboard_(ss) {
  var d = ss.getSheetByName(DASH_SHEET) || ss.insertSheet(DASH_SHEET);
  d.clear();
  d.getRange('A1').setValue('ENGAGEMENT RSVP — DASHBOARD')
   .setFontWeight('bold').setFontSize(14);
  var rows = [
    ['Invitations sent',     '=COUNTA(Invitation!B2:B)'],
    ['Links opened',         '=COUNTIF(Invitation!I2:I,"<>")'],
    ['Responded',            '=COUNTA(RSVP!B2:B)'],
    ['Attending',            '=COUNTIF(RSVP!E2:E,"Attend")'],
    ['Not attending',        '=COUNTIF(RSVP!E2:E,"Not attend")'],
    ['Total pax confirmed',  '=SUM(RSVP!F2:F)'],
    ['Names on guest list',  "=COUNTA('Guest List'!B2:B)"],
    ['Seats allocated',      '=SUM(Invitation!D2:D)'],
    ['Invited to Tea Pai',   '=COUNTIF(Invitation!E2:E,TRUE)'],
    ['Wishes awaiting approval',
     '=COUNTIFS(RSVP!H2:H,"<>",RSVP!I2:I,FALSE)']
  ];
  d.getRange(3, 1, rows.length, 2).setValues(rows);
  d.getRange(3, 1, rows.length, 1).setFontWeight('bold');
  d.setColumnWidth(1, 220);
}

/**
 * Invitation number, personalized link and live status mirrors, for every
 * filled row. The number is =ROW()-1 rather than a typed value so inserting or
 * deleting a row can never leave two invitations sharing a number.
 */
function writeInvitationFormulas_(s) {
  var last = Math.max(s.getLastRow(), 2);
  var n = last - 1;
  if (n < 1) return;

  var key    = 'TRIM(B{r}) & IF(TRIM(C{r})="", "", " & " & TRIM(C{r}))';
  var no     = '=IF(B{r}="","",ROW()-1)';
  var link   = '=IF(B{r}="","", "' + SITE_URL + '?to=" & ENCODEURL(' + key + ') & "&max=" & IF(D{r}="",2,D{r})' +
                 ' & IF(E{r}=TRUE, "&teapai=1", ""))';
  var N = [], L = [];
  for (var i = 0; i < n; i++) {
    var r = i + 2;
    N.push([no.replace(/\{r\}/g, r)]);
    L.push([link.replace(/\{r\}/g, r)]);
  }
  s.getRange(2, ICOL.NO,   n, 1).setFormulas(N);
  s.getRange(2, ICOL.LINK, n, 1).setFormulas(L);

  syncInvitationStatus_(s);
}

/**
 * Mirrors each invitation's answer into Status and Pax confirmed, as plain
 * values.
 *
 * These used to be INDEX/MATCH formulas looking the invitation name up in the
 * RSVP tab. That made two independent things have to agree on a piece of text:
 * the name the spreadsheet rebuilds from "Guest name & Companion name", and the
 * key the web app wrote when the response came in. Any drift between them —
 * different spacing or punctuation, a name edited after the link went out, or a
 * response recorded by an older deployment writing different columns — silently
 * produced blank cells, with nothing to say why.
 *
 * Matching in script removes that: both sides go through normKey_, the very
 * function that produced the stored key, so they cannot disagree. Every RSVP is
 * re-read on each call, which also means this repairs itself — run
 * refreshLinks() and any row that was blank fills in.
 */
function syncInvitationStatus_(s) {
  s = s || sheet_(INV_SHEET);
  var n = s.getLastRow() - 1;
  if (n < 1) return;

  var rsvp = sheet_(RSVP_SHEET);
  var answers = {};
  if (rsvp.getLastRow() > 1) {
    rsvp.getRange(2, 1, rsvp.getLastRow() - 1, HEADERS.length).getValues()
      .forEach(function (r) {
        var k = normKey_(r[COL.KEY - 1]);
        if (k) answers[k] = { attending: r[COL.ATTENDING - 1], pax: r[COL.PAX - 1] };
      });
  }

  var who    = s.getRange(2, ICOL.NAME,  n, 2).getValues();   // name + companion
  var opened = s.getRange(2, ICOL.FIRST, n, 1).getValues();
  var status = [], pax = [];

  for (var i = 0; i < n; i++) {
    var name = String(who[i][0]).trim();
    if (!name) { status.push(['']); pax.push(['']); continue; }

    var comp = String(who[i][1]).trim();
    var a = answers[normKey_(comp ? name + ' & ' + comp : name)];
    if (a) {
      status.push([a.attending]);
      pax.push([a.pax]);
    } else {
      status.push([String(opened[i][0]).trim() ? 'Opened' : 'Not opened']);
      pax.push(['']);
    }
  }
  s.getRange(2, ICOL.STATUS, n, 1).setValues(status);
  s.getRange(2, ICOL.PAX,    n, 1).setValues(pax);
}

/**
 * Re-run after adding invitation rows. Extends the number and link formulas
 * down, and re-reads every RSVP to repair Status and Pax confirmed.
 */
function refreshLinks() {
  SpreadsheetApp.flush();
  writeInvitationFormulas_(sheet_(INV_SHEET));
}

/* ═══════════════ WEB APP ═══════════════ */

function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { p = e.parameter || {}; }

  if (p.action === 'open') return handleOpen_(p);
  return handleRsvp_(p);
}

function handleRsvp_(p) {
  var key = normKey_(p.key || p.name);
  if (!key) return json_({ ok: false, error: 'missing key' });

  var name  = clean_(p.name, 120);
  var going = clean_(p.attending, 20);
  var names = Array.isArray(p.guests)
    ? p.guests.map(function (n) { return clean_(n, 120); }).filter(String)
    : [];

  var invNo = invitationNo_(key);

  var sheet = sheet_(RSVP_SHEET);
  var row   = findRow_(sheet, key);
  var vals  = [
    new Date(),
    key,
    name,
    invNo,
    going,
    Number(p.pax) || 0,
    names.join(', '),
    clean_(p.wishes, 1000)
  ];

  if (row) {
    sheet.getRange(row, 1, 1, vals.length).setValues([vals]);
  } else {
    sheet.appendRow(vals);
    row = sheet.getLastRow();
    // checkbox added per row: pre-filling the column pushes new rows to the bottom
    sheet.getRange(row, COL.APPROVED).insertCheckboxes().setValue(false);
  }

  syncGuestList_(invNo, name, going === 'Attend' ? names : []);
  try { syncInvitationStatus_(); } catch (err) { /* the response is already saved */ }
  return json_({ ok: true });
}

/**
 * Replaces this invitation's block of the Guest List with the names just
 * submitted. Matching on the invitation number when there is one and on the
 * invitation name otherwise means a re-submission corrects the list instead of
 * duplicating it — including someone who first said yes and later said no.
 */
function syncGuestList_(invNo, invName, names) {
  var s = sheet_(GLIST_SHEET);
  var last = s.getLastRow();

  if (last > 1) {
    var rows = s.getRange(2, 1, last - 1, GLHEADERS.length).getValues();
    for (var i = rows.length - 1; i >= 0; i--) {
      var mineByNo   = invNo && String(rows[i][GLCOL.INVNO - 1]) === String(invNo);
      var mineByName = normKey_(rows[i][GLCOL.INVNAME - 1]) === normKey_(invName);
      if (mineByNo || mineByName) s.deleteRow(i + 2);
    }
  }

  if (names.length) {
    var now = wib_(new Date());
    var out = names.map(function (n) { return ['', n, invNo || '', invName, now]; });
    s.getRange(s.getLastRow() + 1, 1, out.length, GLHEADERS.length).setValues(out);
  }
  renumberGuestList_(s);
}

function renumberGuestList_(s) {
  var n = s.getLastRow() - 1;
  if (n < 1) return;
  var nums = [];
  for (var i = 0; i < n; i++) nums.push([i + 1]);
  s.getRange(2, GLCOL.NO, n, 1).setValues(nums);
}

function handleOpen_(p) {
  var key = normKey_(p.key);
  if (!key) return json_({ ok: false });

  var s   = sheet_(INV_SHEET);
  var row = invitationRow_(s, key);
  if (!row) return json_({ ok: false });

  var now = wib_(new Date());
  if (!String(s.getRange(row, ICOL.FIRST).getValue()).trim()) {
    s.getRange(row, ICOL.FIRST).setValue(now);
  }
  s.getRange(row, ICOL.LAST).setValue(now);
  s.getRange(row, ICOL.OPENS).setValue((Number(s.getRange(row, ICOL.OPENS).getValue()) || 0) + 1);

  var cell = s.getRange(row, ICOL.STATUS);
  var now_ = String(cell.getValue()).trim();
  if (!now_ || now_ === 'Not opened') cell.setValue('Opened');
  return json_({ ok: true });
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'wishes';
  if (action === 'status') return json_(getStatus_(e.parameter.key));
  return json_(getWishes_());
}

/** The name on a wish is the invitation name — guests never type one. */
function getWishes_() {
  var sheet = sheet_(RSVP_SHEET);
  if (sheet.getLastRow() < 2) return [];

  return sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues()
    .filter(function (r) { return r[COL.APPROVED - 1] === true && String(r[COL.WISHES - 1]).trim(); })
    .map(function (r) {
      return {
        name:   String(r[COL.NAME - 1]),
        wishes: String(r[COL.WISHES - 1]),
        time:   stamp_(r[COL.TIME - 1])
      };
    })
    .reverse();
}

function getStatus_(rawKey) {
  var key = normKey_(rawKey);
  if (!key) return { found: false };
  var sheet = sheet_(RSVP_SHEET);
  var row   = findRow_(sheet, key);
  if (!row) return { found: false };
  var v = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  return {
    found: true,
    name:      String(v[COL.NAME - 1]),
    invitation: v[COL.INVNO - 1],
    attending: String(v[COL.ATTENDING - 1]),
    pax:       Number(v[COL.PAX - 1]) || 0,
    guests:    String(v[COL.GUESTS - 1]),
    wishes:    String(v[COL.WISHES - 1])
  };
}

/* ═══════════════ HELPERS ═══════════════ */

function sheet_(name) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s) throw new Error('Missing sheet: ' + name + ' — run setup() first.');
  return s;
}

/**
 * Re-reads a tab into the given header order, looking each column up by its
 * name. Columns that moved follow their header; columns that did not exist
 * before come back blank. `aliases` maps a new header to older spellings.
 */
function readByHeader_(sheet, headers, aliases) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var width = sheet.getLastColumn();
  var head  = sheet.getRange(1, 1, 1, width).getValues()[0];
  var body  = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();

  var idx = {};
  head.forEach(function (h, i) { idx[String(h).trim()] = i; });

  return body.map(function (row) {
    return headers.map(function (h) {
      var names = [h].concat((aliases && aliases[h]) || []);
      for (var i = 0; i < names.length; i++) {
        if (idx[names[i]] !== undefined) return row[idx[names[i]]];
      }
      return '';
    });
  });
}

function findRow_(sheet, key) {
  if (sheet.getLastRow() < 2) return 0;
  var keys = sheet.getRange(2, COL.KEY, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (normKey_(keys[i][0]) === key) return i + 2;
  }
  return 0;
}

/** The invitation row whose "Name & Companion" builds this key. */
function invitationRow_(s, key) {
  if (s.getLastRow() < 2) return 0;
  var rows = s.getRange(2, ICOL.NAME, s.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    var name = String(rows[i][0]).trim();
    var comp = String(rows[i][1]).trim();
    if (!name) continue;
    var built = comp ? name + ' & ' + comp : name;
    if (normKey_(built) === key) return i + 2;
  }
  return 0;
}

/** Column A is =ROW()-1, so the number is the row index; 0 = not on the list. */
function invitationNo_(key) {
  try {
    var row = invitationRow_(sheet_(INV_SHEET), key);
    return row ? row - 1 : '';
  } catch (err) {
    return '';
  }
}

function normKey_(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
}

function wib_(d) {
  return Utilities.formatDate(d, TZ, 'd MMM yyyy, HH:mm');
}

function stamp_(v) {
  if (v instanceof Date) return v.toISOString();
  var d = new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function clean_(s, max) {
  return String(s == null ? '' : s).trim().slice(0, max);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
