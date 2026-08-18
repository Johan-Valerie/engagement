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
 */

var RSVP_SHEET   = 'RSVP';
var GUESTS_SHEET = 'Guests';
var DASH_SHEET   = 'Dashboard';

var SITE_URL = 'https://johangw.github.io/johan-valerie-engagement/';
var TZ       = 'Asia/Jakarta';

/* RSVP columns (1-based) */
var COL = { TIME:1, KEY:2, NAME:3, ATTENDING:4, PAX:5, WISHES:6, APPROVED:7 };
var HEADERS = ['Timestamp','Guest link (key)','Name','Attending','Pax','Wishes','Approved'];

/* Guests columns (1-based) */
var GCOL = { NAME:1, COMPANION:2, SEATS:3, LINK:4, STATUS:5, PAX:6, FIRST:7, LAST:8, OPENS:9 };
var GHEADERS = ['Guest name','Companion name','Max seats','Personalized link',
                'Status','Pax confirmed','First opened (WIB)','Last opened (WIB)','Opens'];

/* ═══════════════ ONE-TIME SETUP ═══════════════ */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);

  // ── RSVP tab ──
  var r = ss.getSheetByName(RSVP_SHEET) || ss.insertSheet(RSVP_SHEET);
  r.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
   .setFontWeight('bold').setBackground('#292929').setFontColor('#ffffff');
  r.setFrozenRows(1);
  r.setColumnWidth(COL.WISHES, 340);
  r.setColumnWidth(COL.KEY, 200);

  // ── Guests tab (the control panel) ──
  // Rebuilt by header name, so any earlier layout is preserved.
  var g = ss.getSheetByName(GUESTS_SHEET);
  var kept = [];
  if (g && g.getLastRow() > 1) {
    var head = g.getRange(1, 1, 1, g.getLastColumn()).getValues()[0];
    var body = g.getRange(2, 1, g.getLastRow() - 1, g.getLastColumn()).getValues();
    var idx = {};
    head.forEach(function (h, i) { idx[String(h).trim()] = i; });
    kept = body.map(function (row) {
      var pick = function (name) {
        return idx[name] === undefined ? '' : row[idx[name]];
      };
      return [pick('Guest name'), pick('Companion name'), pick('Max seats'),
              pick('First opened (WIB)'), pick('Last opened (WIB)'), pick('Opens')];
    }).filter(function (row) { return String(row[0]).trim() !== ''; });
  }
  if (g) ss.deleteSheet(g);
  g = ss.insertSheet(GUESTS_SHEET);

  g.getRange(1, 1, 1, GHEADERS.length).setValues([GHEADERS])
   .setFontWeight('bold').setBackground('#292929').setFontColor('#ffffff');
  g.setFrozenRows(1);
  g.setColumnWidth(GCOL.NAME, 210);
  g.setColumnWidth(GCOL.COMPANION, 180);
  g.setColumnWidth(GCOL.LINK, 420);

  if (kept.length) {
    var out = kept.map(function (row) {
      return [row[0], row[1], row[2] || 2, '', '', '', row[3], row[4], row[5]];
    });
    g.getRange(2, 1, out.length, GHEADERS.length).setValues(out);
  }

  writeGuestFormulas_(g);

  // ── Dashboard ──
  var d = ss.getSheetByName(DASH_SHEET) || ss.insertSheet(DASH_SHEET);
  d.clear();
  d.getRange('A1').setValue('ENGAGEMENT RSVP — DASHBOARD')
   .setFontWeight('bold').setFontSize(14);
  var rows = [
    ['Guests invited',      '=COUNTA(Guests!A2:A)'],
    ['Links opened',        '=COUNTIF(Guests!G2:G,"<>")'],
    ['Responded',           '=COUNTA(RSVP!B2:B)'],
    ['Attending',           '=COUNTIF(RSVP!D2:D,"Attend")'],
    ['Not attending',       '=COUNTIF(RSVP!D2:D,"Not attend")'],
    ['Total pax confirmed', '=SUM(RSVP!E2:E)'],
    ['Seats allocated',     '=SUM(Guests!C2:C)'],
    ['Wishes awaiting approval',
     '=COUNTIFS(RSVP!F2:F,"<>",RSVP!G2:G,FALSE)']
  ];
  d.getRange(3, 1, rows.length, 2).setValues(rows);
  d.getRange(3, 1, rows.length, 1).setFontWeight('bold');
  d.setColumnWidth(1, 220);

  SpreadsheetApp.getUi().alert('Setup complete. Now Deploy → New deployment → Web app.');
}

/** Personalized link + live status mirrors, for every filled guest row. */
function writeGuestFormulas_(g) {
  var last = Math.max(g.getLastRow(), 2);
  var n = last - 1;
  if (n < 1) return;

  var key    = 'TRIM(A{r}) & IF(TRIM(B{r})="", "", " & " & TRIM(B{r}))';
  var link   = '=IF(A{r}="","", "' + SITE_URL + '?to=" & ENCODEURL(' + key + ') & "&max=" & IF(C{r}="",2,C{r}))';
  var status = '=IF(A{r}="","",' +
                 'IFERROR(INDEX(RSVP!$D:$D, MATCH(' + key + ', RSVP!$B:$B, 0)),' +
                   'IF(G{r}="", "Not opened", "Opened")))';
  var pax    = '=IF(A{r}="","", IFERROR(INDEX(RSVP!$E:$E, MATCH(' + key + ', RSVP!$B:$B, 0)), ""))';

  var L = [], S = [], P = [];
  for (var i = 0; i < n; i++) {
    var r = i + 2;
    L.push([link.replace(/\{r\}/g, r)]);
    S.push([status.replace(/\{r\}/g, r)]);
    P.push([pax.replace(/\{r\}/g, r)]);
  }
  g.getRange(2, GCOL.LINK,   n, 1).setFormulas(L);
  g.getRange(2, GCOL.STATUS, n, 1).setFormulas(S);
  g.getRange(2, GCOL.PAX,    n, 1).setFormulas(P);
}

/** Re-run after adding guest rows, to extend the formulas down. */
function refreshLinks() {
  writeGuestFormulas_(sheet_(GUESTS_SHEET));
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

  var sheet = sheet_(RSVP_SHEET);
  var row   = findRow_(sheet, key);
  var vals  = [
    new Date(),
    key,
    clean_(p.name, 120),
    clean_(p.attending, 20),
    Number(p.pax) || 0,
    clean_(p.wishes, 1000),
  ];

  if (row) {
    sheet.getRange(row, 1, 1, vals.length).setValues([vals]);
  } else {
    sheet.appendRow(vals);
    row = sheet.getLastRow();
    // checkbox added per row: pre-filling the column pushes new rows to the bottom
    sheet.getRange(row, COL.APPROVED).insertCheckboxes().setValue(false);
  }
  return json_({ ok: true });
}

function handleOpen_(p) {
  var key = normKey_(p.key);
  if (!key) return json_({ ok: false });

  var g   = sheet_(GUESTS_SHEET);
  var row = guestRow_(g, key);
  if (!row) return json_({ ok: false });

  var now = wib_(new Date());
  if (!String(g.getRange(row, GCOL.FIRST).getValue()).trim()) {
    g.getRange(row, GCOL.FIRST).setValue(now);
  }
  g.getRange(row, GCOL.LAST).setValue(now);
  g.getRange(row, GCOL.OPENS).setValue((Number(g.getRange(row, GCOL.OPENS).getValue()) || 0) + 1);
  return json_({ ok: true });
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'wishes';
  if (action === 'status') return json_(getStatus_(e.parameter.key));
  return json_(getWishes_());
}

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
    attending: String(v[COL.ATTENDING - 1]),
    pax:       Number(v[COL.PAX - 1]) || 0,
    wishes:    String(v[COL.WISHES - 1])
  };
}

/* ═══════════════ HELPERS ═══════════════ */

function sheet_(name) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s) throw new Error('Missing sheet: ' + name + ' — run setup() first.');
  return s;
}

function findRow_(sheet, key) {
  if (sheet.getLastRow() < 2) return 0;
  var keys = sheet.getRange(2, COL.KEY, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (normKey_(keys[i][0]) === key) return i + 2;
  }
  return 0;
}

function guestRow_(g, key) {
  if (g.getLastRow() < 2) return 0;
  var rows = g.getRange(2, 1, g.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    var name = String(rows[i][0]).trim();
    var comp = String(rows[i][1]).trim();
    if (!name) continue;
    var built = comp ? name + ' & ' + comp : name;
    if (normKey_(built) === key) return i + 2;
  }
  return 0;
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
