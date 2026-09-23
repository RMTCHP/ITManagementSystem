# Web Upload Package

This folder contains the flat deployment package for the web frontend and Google Apps Script backend.

## Files

- `index.html`
- `dashboard.html`
- `assets.html`
- `tickets.html`
- `access-management.html`
- `inventory.html`
- `stock-movements.html`
- `licenses.html`
- `document-center.html`
- `administration.html`
- `audit-log.html`
- `reports.html`
- `register.html`
- `app.css`
- `config.js`
- `api.js`
- `ui.js`
- `shell.js`
- `dashboard.js`
- `module-page.js`
- `reports-page.js`
- `login.js`
- `register.js`
- `code.gs`
- `appsscript.json`

## Deployment Steps

1. Upload all frontend `.html`, `.js`, and `.css` files in this folder to GitHub Pages or another static host.
2. Copy `code.gs` into Google Apps Script.
3. Set Script Property `SPREADSHEET_ID` if you use a standalone Apps Script project.
4. Run `initializeSystem()` to create or update the required sheet schema. It does not create sample records or default user accounts.
   Approve the Google Sheet and Google Drive permissions when prompted. Drive permission is required for IT Knowledge Center file uploads.
5. Run `setupKnowledgeDrive()` once from the Apps Script editor. Approve the Drive request and confirm that it returns a folder URL.
6. Deploy the Apps Script project as a Web App, with `Execute as: Me`.
7. Paste the Web App URL into `config.js` at `webAppUrl`.
   Current deployment URL:
   `https://script.google.com/macros/s/AKfycbyaVMRI-LjvuBC44I7rVBJszSigLh2ayrXBYY6kcl0YsX8nuiKrhW4NlndYsBqnBUc/exec`
8. Hard refresh the browser after updating the Web App deployment URL or Apps Script logic.

## Notes

- `webAppUrl` is required. The frontend will show a clear configuration error if it is missing.
- All frontend pages read the Apps Script URL from `config.js`.
- The frontend uses form-urlencoded requests for Google Apps Script compatibility.
