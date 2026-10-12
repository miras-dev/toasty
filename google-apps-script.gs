/**
 * Toasty Turtle Cafe — Website forms → Google Sheet + Email + WhatsApp (Twilio)
 *
 * Handles the three website forms. Each form sends a hidden "sheet" field that
 * picks the tab it is saved to:
 *   Reservations  (reservation.html)
 *   Contact       (contact.html)
 *   Franchise     (franchise.html)
 *
 * For every submission it:
 *   1. appends a row to the matching tab (tabs + headers are created automatically)
 *   2. emails the owner
 *   3. sends the owner a WhatsApp message through Twilio
 *   4. (optional, off by default) sends the guest a WhatsApp reservation confirmation
 *
 * ─── SETUP ────────────────────────────────────────────────────────────────────
 * 1. Open the Google Sheet → Extensions → Apps Script. Paste this whole file.
 *
 * 2. Project Settings (gear icon) → Script Properties → add:
 *      OWNER_EMAIL           hello@toastyturtle.de
 *      TWILIO_ACCOUNT_SID    ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *      TWILIO_AUTH_TOKEN     your Twilio auth token
 *      TWILIO_WHATSAPP_FROM  whatsapp:+14155238886   (sandbox number, or your approved sender)
 *      OWNER_WHATSAPP_TO     whatsapp:+49XXXXXXXXXXX (comma-separate for several people)
 *      OWNER_CONTENT_SID     HXxxxxxxxx  (approved template for owner alerts — see below)
 *    Optional:
 *      CUSTOMER_CONFIRMATION       true   (WhatsApp the guest after a reservation)
 *      CONFIRMATION_CONTENT_SID    HXxxxxxxxx (approved Twilio template; needed in production)
 *      DEFAULT_COUNTRY_CODE        49     (used when a guest types a number like 0151…)
 *    Secrets live in Script Properties, never in this file or the website code.
 *
 *    WhatsApp only allows free text within 24h of the person last messaging you
 *    (otherwise Twilio error 63016). Alerts therefore use an approved template:
 *    Twilio console → Messaging → Content Template Builder → Create new
 *      Name: toasty_new_submission   Category: Utility   Language: English
 *      Type: Text   Body:
 *        New website submission: {{1}}
 *
 *        Details: {{2}}
 *
 *        Received {{3}}. Full entry is in the Google Sheet.
 *      Sample values: {{1}} New reservation — Anna (24/12/2026 19:00)
 *                     {{2}} Phone: +49 151 2345678 · Guests: 2
 *                     {{3}} 12.10.2026 20:15
 *    Submit for WhatsApp approval, then copy its Content SID (HX…) into OWNER_CONTENT_SID.
 *    Without OWNER_CONTENT_SID the script falls back to free text (sandbox testing only).
 *
 * 3. Select the function "setup" in the toolbar → Run. Approve the permissions.
 *    This creates the tabs and checks your settings.
 *    Then run "testWhatsApp" — you should receive a WhatsApp message.
 *
 * 4. Deploy → New deployment → type "Web app"
 *      Execute as:      Me
 *      Who has access:  Anyone
 *    Copy the Web App URL into js/main.js → GOOGLE_SCRIPT_URL.
 *
 *    After editing this script later: Deploy → Manage deployments → edit →
 *    Version "New version". (Keeps the same URL.)
 * ──────────────────────────────────────────────────────────────────────────────
 */

var FORMS = {
  Reservations: {
    fields:  ['name', 'phone', 'date', 'guests'],
    headers: ['Timestamp', 'Name', 'Phone', 'Date & Time', 'Guests'],
    title:   function (d) { return 'New reservation — ' + d.name + ' (' + d.date + ')'; },
    emoji:   '🍽️'
  },
  Contact: {
    fields:  ['name', 'email', 'phone', 'message'],
    headers: ['Timestamp', 'Name', 'Email', 'Phone', 'Message'],
    title:   function (d) { return 'New message — ' + d.name; },
    emoji:   '✉️'
  },
  Franchise: {
    fields:  ['name', 'email', 'phone', 'city', 'country', 'message'],
    headers: ['Timestamp', 'Name', 'Email', 'Phone', 'City', 'Country', 'Message'],
    title:   function (d) { return 'New franchise enquiry — ' + d.name + ' (' + d.city + ', ' + d.country + ')'; },
    emoji:   '🐢'
  }
};

var LABELS = {
  name: 'Name', phone: 'Phone', email: 'Email', date: 'Date & Time', guests: 'Guests',
  city: 'City', country: 'Country', message: 'Message'
};

var TIMEZONE = 'Europe/Berlin';


/* ── Web app entry points ───────────────────────────────────────────────────── */

function doPost(e) {
  var params = (e && e.parameter) || {};
  var formName = FORMS[params.sheet] ? params.sheet : 'Reservations';
  var form = FORMS[formName];

  var data = {};
  form.fields.forEach(function (f) { data[f] = clean(params[f]); });
  var timestamp = new Date();

  // 1. Save — this is the part that must never be lost
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getOrCreateTab(formName);
    sheet.appendRow([timestamp].concat(form.fields.map(function (f) { return safeCell(data[f]); })));
  } catch (err) {
    console.error('Saving failed: ' + err);
    return json({ result: 'error', error: 'save_failed' });
  } finally {
    lock.releaseLock();
  }

  // 2–4. Notifications — a failure here never loses the saved row
  var when = Utilities.formatDate(timestamp, TIMEZONE, 'dd.MM.yyyy HH:mm');
  var lines = form.fields
    .filter(function (f) { return data[f]; })
    .map(function (f) { return LABELS[f] + ': ' + data[f]; });

  try {
    sendOwnerEmail(form.title(data), lines, when);
  } catch (err) {
    console.error('Email failed: ' + err);
  }

  try {
    sendOwnerAlert(form.emoji + ' ' + form.title(data), lines, when);
  } catch (err) {
    console.error('Owner WhatsApp failed: ' + err);
  }

  if (formName === 'Reservations' && prop('CUSTOMER_CONFIRMATION') === 'true') {
    try {
      sendGuestConfirmation(data);
    } catch (err) {
      console.error('Guest WhatsApp failed: ' + err);
    }
  }

  return json({ result: 'success' });
}

function doGet() {
  return json({ result: 'ok' });
}


/* ── Run these from the Apps Script editor ──────────────────────────────────── */

/** Creates the tabs with headers and reports any missing settings. Run once. */
function setup() {
  Object.keys(FORMS).forEach(getOrCreateTab);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  var required = ['OWNER_EMAIL', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM', 'OWNER_WHATSAPP_TO'];
  var missing = required.filter(function (k) { return !prop(k); });
  console.log(missing.length
    ? 'Tabs ready. Missing Script Properties: ' + missing.join(', ')
    : 'Tabs ready. All settings present — now run testWhatsApp.');
  if (!prop('OWNER_CONTENT_SID')) {
    console.warn('OWNER_CONTENT_SID not set: alerts are sent as free text and will fail with ' +
                 'Twilio error 63016 unless you messaged the WhatsApp number in the last 24h.');
  }
}

/** Sends a test WhatsApp to the owner number(s), using the template if one is set. */
function testWhatsApp() {
  sendOwnerAlert('🐢 Test alert', ['WhatsApp notifications are working'],
                 Utilities.formatDate(new Date(), TIMEZONE, 'dd.MM.yyyy HH:mm'));
  console.log('Sent. Check WhatsApp (and the Twilio console → Monitor → Messaging logs if nothing arrives).');
}

/** Simulates a reservation end-to-end (writes a real row — delete it afterwards). */
function testReservation() {
  doPost({ parameter: { sheet: 'Reservations', name: 'Test Guest', phone: '+49 151 00000000', date: '24/12/2026 19:00', guests: '2' } });
  console.log('Done — check the Reservations tab, your email and WhatsApp.');
}


/* ── Helpers ────────────────────────────────────────────────────────────────── */

function getOrCreateTab(formName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(formName) || ss.insertSheet(formName);
  if (sheet.getLastRow() === 0) {
    var headers = FORMS[formName].headers;
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#08510a').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('dd.mm.yyyy hh:mm');
  }
  return sheet;
}

function sendOwnerEmail(subject, lines, when) {
  var to = prop('OWNER_EMAIL');
  if (!to) return;
  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: lines.join('\n') + '\n\nSubmitted: ' + when + '\n\n— Toasty Turtle Cafe website'
  });
}

/** WhatsApp alert to the owner number(s): approved template if configured, else free text. */
function sendOwnerAlert(title, lines, when) {
  var to = prop('OWNER_WHATSAPP_TO');
  if (!to) return;
  var contentSid = prop('OWNER_CONTENT_SID');
  var message = contentSid
    ? {
        ContentSid: contentSid,
        ContentVariables: JSON.stringify({
          '1': templateVar(title, 200),
          '2': templateVar(lines.join(' · '), 900),
          '3': templateVar(when, 50)
        })
      }
    : { Body: '*' + title + '*\n\n' + lines.join('\n') + '\n\n_' + when + '_' };

  to.split(',').forEach(function (n) {
    var payload = { To: toWhatsApp(n.trim()) };
    Object.keys(message).forEach(function (k) { payload[k] = message[k]; });
    twilioSend(payload);
  });
}

/** WhatsApp rejects template variables containing newlines, tabs or 4+ spaces. */
function templateVar(v, max) {
  var s = String(v || '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  if (s.length > max) s = s.slice(0, max - 1) + '…';
  return s || '-';
}

function sendGuestConfirmation(d) {
  var number = toWhatsApp(d.phone);
  if (!number) return;
  var contentSid = prop('CONFIRMATION_CONTENT_SID');
  if (contentSid) {
    // Approved template, variables {{1}} name, {{2}} date & time, {{3}} guests
    twilioSend({
      To: number,
      ContentSid: contentSid,
      ContentVariables: JSON.stringify({ '1': templateVar(d.name, 100), '2': templateVar(d.date, 50), '3': templateVar(d.guests, 10) })
    });
  } else {
    // Free-form text only reaches people who have messaged you in the last 24h
    // (or joined the sandbox) — use a template for production.
    twilioSend({
      To: number,
      Body: 'Hi ' + d.name + '! 🐢 Your table for ' + d.guests + ' at Toasty Turtle Cafe on ' + d.date +
            ' is noted. See you soon! Need to change it? Just reply to this message.'
    });
  }
}

function twilioSend(payload) {
  var sid = prop('TWILIO_ACCOUNT_SID');
  var token = prop('TWILIO_AUTH_TOKEN');
  var from = prop('TWILIO_WHATSAPP_FROM');
  if (!sid || !token || !from) throw new Error('Twilio settings missing in Script Properties');

  payload.From = toWhatsApp(from);
  var res = UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
    method: 'post',
    payload: payload,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token) },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code >= 300) throw new Error('Twilio ' + code + ': ' + res.getContentText());
}

/** "0151 234 567" / "+49 151…" / "whatsapp:+49…" → "whatsapp:+49151234567" */
function toWhatsApp(raw) {
  if (!raw) return '';
  var s = String(raw).replace(/^whatsapp:/, '').replace(/[^\d+]/g, '');
  if (s.indexOf('00') === 0) s = '+' + s.slice(2);
  if (s.charAt(0) === '0') s = '+' + (prop('DEFAULT_COUNTRY_CODE') || '49') + s.slice(1);
  if (s.charAt(0) !== '+') s = '+' + s;
  return s.length >= 9 ? 'whatsapp:' + s : '';
}

function prop(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function clean(v) {
  return String(v == null ? '' : v).trim().slice(0, 2000);
}

/** Stop submitted text like "=IMPORTXML(...)" from running as a formula. */
function safeCell(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
