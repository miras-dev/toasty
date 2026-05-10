/**
 * Toasty Turtle Cafe — Reservation Google Apps Script
 *
 * HOW TO SET UP:
 * 1. Open your Google Sheet (create one if needed, name the first tab "Reservations").
 * 2. In the Sheet, go to Extensions → Apps Script.
 * 3. Delete any existing code and paste this entire file.
 * 4. Set OWNER_EMAIL below to the restaurant email address.
 * 5. Click Deploy → New deployment → Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Click Deploy and copy the Web App URL.
 * 7. Paste that URL into js/main.js as the value of GOOGLE_SCRIPT_URL.
 *
 * The sheet columns will be auto-created on first submission:
 * Timestamp | Name | Phone | Date & Time | Guests
 */

var OWNER_EMAIL = 'hello@toastyturtle.de'; // Change this to your email

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reservations');

    // Create header row if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Date & Time', 'Guests']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }

    var name     = e.parameter.name     || '';
    var phone    = e.parameter.phone    || '';
    var date     = e.parameter.date     || '';
    var guests   = e.parameter.guests   || '';
    var timestamp = new Date();

    // Append the new reservation row
    sheet.appendRow([timestamp, name, phone, date, guests]);

    // Send email notification to the owner
    var subject = 'New Reservation — ' + name + ' (' + date + ')';
    var body = [
      'A new table reservation has been made at Toasty Turtle Cafe.',
      '',
      'Customer details:',
      '  Name:       ' + name,
      '  Phone:      ' + phone,
      '  Date & Time:' + date,
      '  Guests:     ' + guests,
      '',
      'Submitted at: ' + timestamp.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
      '',
      '— Toasty Turtle Cafe Reservation System',
    ].join('\n');

    MailApp.sendEmail({
      to: OWNER_EMAIL,
      subject: subject,
      body: body,
    });

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Needed so Google can verify the script is a valid web app
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ result: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
