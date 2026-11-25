# OCRaccounting

Private, free, mobile-first receipt scanner. It reads receipts with on-device OCR, sorts them into
expense categories (Petrol, Food, Entertainment, Gift, Telco, …) and totals your spending per
month in RM. All data stays on your device: no cloud, no paid APIs, no login.

- Live camera scanning with auto-crop and blur check for a clear receipt image
- Free on-device OCR (Tesseract.js), works offline
- Automatic categorisation with confidence scores
- Review queue to fix wrong or uncertain categories (the app learns from your fixes)
- Monthly totals, charts and CSV / Excel / PDF export

See [PLAN.md](PLAN.md) for the tech stack, design and milestones.

## Status

Milestone 1 done: app shell, on-device storage, photo → **Month/Category folders** with pictures,
monthly totals, edit/re-categorise, summary CSV, ZIP export and PC folder sync.
Next: live scanner with auto-crop (milestone 2), then OCR (milestone 3).

## Run it

```powershell
npm install
npm run dev
```

- PC: open http://localhost:5173
- Phone on the same Wi-Fi: open the `Network:` address Vite prints. The **Take photo** button
  opens the phone camera. (The live scanner in milestone 2 needs HTTPS — we'll set that up then.)

```powershell
npm test
```

## Where the pictures go

```
OCRaccounting/2026-11/Petrol/2026-11-03_Shell_RM80.00.jpg
OCRaccounting/2026-11/summary-2026-11.csv   <- total per category + grand total
```

- **PC (Chrome/Edge)**: Settings → *Choose folder*. Pictures and the summary CSV are written there
  and kept up to date automatically.
- **Phone**: Total → *Pictures + total (ZIP)*, or Settings → *Save all as ZIP*, then save to Files /
  Google Drive.
