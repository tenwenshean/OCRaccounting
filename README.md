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

Milestones 1–5 done:

- **Live scanner**: the camera outlines the receipt, shows keywords it can read, and **captures automatically**
  once the receipt is steady and sharp (sharpest of 3 frames). It then crops, flattens and cleans the picture.
- **Free on-device OCR** (Tesseract.js) reads shop, date and total (`TOTAL`, `GRAND TOTAL`, `JUMLAH`, cash − change…).
- **Auto category**: your past fixes → known Malaysian shops → keywords → learned classifier.
  Confident receipts are filed straight into `YYYY-MM/Category`. Unsure ones go to **Review**.
- **Review**: one tap picks the right category and the app remembers that shop next time.
- Duplicate scans are ignored. Monthly totals, folder view, ZIP/CSV export and PC folder sync as before.

Next: budgets, PaddleOCR comparison on real receipts, backup/restore.

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
