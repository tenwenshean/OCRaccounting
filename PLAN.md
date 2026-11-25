# OCRaccounting — Tech Stack & Plan

Private, single-user, **100% free** receipt scanner. You snap a receipt live with your phone
camera, the app crops it to a clean image, reads it with on-device OCR, works out the category
(Petrol, Food, Gift, Telco…), and adds up spending per month in RM. When it is unsure or wrong,
you fix the category and it learns from you.

**Everything runs and is stored on your own device.** No paid API, no cloud database, no login.

### Decisions made
| Question | Decision |
|---|---|
| OCR engine | Free and on-device: **Tesseract.js**, with **PaddleOCR (ONNX)** as an optional upgrade |
| Users | Just you. No accounts or login. |
| Data | Kept on the device (browser storage). Backup/restore is a file you control. |

---

## 1. Tech stack (all free)

| Layer | Choice | Why |
|---|---|---|
| App type | **PWA** (installable web app) | Works on Android, iPhone and PC. Add to Home Screen and it works **offline**. |
| Frontend | **Vite + React + TypeScript** + **Tailwind CSS** | No server needed. Builds a static site that is small and fast on a phone. |
| Live camera | `getUserMedia` (rear camera, highest resolution, torch if supported) | Built into mobile Chrome and Safari. |
| Clear picture | **OpenCV.js** (via `jscanify`) | Detects the receipt edges live, flattens the perspective, removes shadows, sharpens and converts to clean black-and-white for OCR. |
| Quality checks | Blur score (Laplacian variance) and brightness check | Auto-captures only when the receipt is steady, sharp and well lit. Otherwise it tells you to hold still or find more light. |
| OCR | **Tesseract.js** (English + Malay) in a Web Worker | Free, runs on the phone, no internet needed after the first load. |
| OCR upgrade (milestone 7) | **PaddleOCR via onnxruntime-web** | Also free and on-device, usually noticeably better on thermal receipts. We'll compare it with Tesseract on your real receipts and keep whichever reads them better. |
| Receipt parsing | Own TypeScript parser | Finds the merchant, date (`DD/MM/YYYY`, `DD-MM-YY`, `25 Nov 2026`…), `TOTAL` / `JUMLAH` / `GRAND TOTAL`, `RM`, SST and the payment line. |
| Categorising | Rules + keyword scoring + a small classifier that learns from your corrections (all local) | See section 2. Nothing leaves the device. |
| Storage | **IndexedDB** (via Dexie.js) for receipts and images | Holds thousands of receipts and images in the browser on the device. Asks the browser for persistent storage so they aren't auto-cleared. |
| Charts / export | Recharts; CSV + Excel (SheetJS) + PDF (jsPDF) + ZIP (JSZip) | Monthly summary and exported files, all created on the device. |
| Hosting the app code | **Vercel free** or **Cloudflare Pages free** (static) | The camera needs HTTPS. Only the app code is hosted. Your receipts never go to the host. |
| Testing | Vitest (parser, categoriser, totals) + Playwright (phone screen size) | Sample receipts in `samples/` keep accuracy from getting worse. |

> Because data is local, the phone and PC do **not** sync automatically. To move data, use
> **Backup → Export** (one `.zip` file with images and data) and **Restore** on the other device.

---

## 2. How the app tells categories apart (no AI, no cost)

Each step gives a category **and a confidence score**, and the first one that's sure enough wins.

1. **Your corrections (learned merchant rules)**: if you once moved "Kedai Runcit Ah Seng" to
   Food, every receipt from that merchant goes to Food. Merchant names are fuzzy-matched so OCR
   typos still match. Confidence: very high.
2. **Built-in Malaysian merchant list** (fuzzy match on the top lines of the receipt):
   - Petrol: Petronas, Shell, Petron, Caltex, BHPetrol, Setel
   - Telco: Maxis, Hotlink, CelcomDigi, U Mobile, Unifi, Yes, TM
   - Food: McDonald's, KFC, Tealive, ZUS, Starbucks, Secret Recipe, GrabFood, foodpanda
   - Entertainment: GSC, TGV, MBO, Netflix, Spotify, Steam
   - Groceries: Lotus's, AEON, Mydin, Jaya Grocer, 99 Speedmart, KK Mart
   - Others as needed: Transport/Toll/Parking, Utilities, Health, Shopping, Gift
3. **Keyword scoring** on the full receipt text, with weights:
   - Petrol: `RON95`, `RON97`, `diesel`, `litre`, `pump`
   - Telco: `prepaid`, `postpaid`, `reload`, `topup`
   - Food: `nasi`, `teh`, `kopi`, `mee`, `meal`, `dine in`, `takeaway`
   - Gift: `gift card`, `hamper`, `gift wrap`, `florist`
4. **Local learning classifier** (naive Bayes on the receipt words): trained on the device only
   from receipts you have confirmed, so it gets better the more you use it.
5. **Decision**:
   - Confident, and the steps agree → filed automatically (you can still edit it).
   - Low confidence, steps disagree, or total/date unreadable → **"Needs Review"** queue.

Categories are yours to add, rename or delete, each with its own colour, icon and keywords.

---

## 3. Fixing errors / false positives

- **Review queue**: shows the clean image, the OCR'd merchant, total and date (highlighted on the
  image), the suggested category and *why* (e.g. "matched keyword RON95"). One tap to confirm or
  pick another category.
- **Edit any receipt** at any time: category, total, date, merchant.
- **Split receipt** (e.g. a petrol station receipt with snacks: Petrol RM80 + Food RM12).
- **"Always use this category for this merchant"**: saves a learned rule (section 2, step 1).
- **Duplicate warning**: if the merchant, total and date match an earlier receipt, you're warned before it's saved again.
- **Manual entry**: when a receipt is too faded to read, type the total yourself and keep the photo.
- Monthly totals update straight away after any change.

---

## 4. Monthly calculation

```
November 2026
Petrol         RM  500.00
Food           RM  600.00
Gift           RM  300.00
Telco          RM   30.00
----------------------------
Total          RM 1,430.00
Needs review   2 receipts (RM 45.20, not counted until confirmed)
```

- Money stored as **integer sen**, so totals have no rounding errors.
- The month comes from the **receipt date**, not the scan date, and you can edit it.
- Month-over-month comparison and an optional budget per category with warnings.
- Export a month as CSV / Excel / PDF, plus a ZIP of the clean images in folders like
  `2026-11/Petrol/2026-11-03_Shell_RM80.00.jpg`.

---

## 4b. Scanned pictures saved into folders, with totals

Each scanned receipt is saved as a clean JPEG, filed into a **Month → Category** folder:

```
OCRaccounting/
  2026-11/
    Petrol/   2026-11-03_Shell_RM80.00.jpg  ...
    Food/     2026-11-04_KFC_RM23.50.jpg     ...
    Telco/    2026-11-10_Maxis_RM30.00.jpg
    summary-2026-11.csv      <- totals per category + grand total
```

- **In the app**: a **Folders** screen shows the same Month → Category tree, with picture
  thumbnails and the total for each folder and month.
- **PC (Chrome / Edge)**: choose a real folder once. Every scan is then written straight into it and
  `summary-YYYY-MM.csv` is rewritten whenever a total changes (File System Access API).
- **Phone (Android / iPhone)**: browsers can't write into phone folders, so **Save to folder** creates
  a ZIP with exactly that folder layout + summary, which you save to Files / Google Drive / your PC.
- When you change a receipt's category, its picture moves to the new folder and both totals update.

---

## 5. Local data model (IndexedDB)

- `categories`: id, name, colour, icon, keywords[]
- `receipts`: id, imageBlob (clean JPEG), merchant, receiptDate, totalSen, taxSen,
  categoryId, confidence, reason, status (`auto` | `needs_review` | `confirmed`), ocrText, createdAt
- `splits`: receiptId, categoryId, amountSen
- `merchantRules`: merchantPattern, categoryId (learned from your corrections)
- `classifierModel`: word counts per category (the local learning model)

---

## 6. Screens

1. **Scan**: full-screen live camera with a green outline when a receipt is detected. It captures automatically, or you can pick a photo from your gallery. You then see the cleaned image and choose retake or accept.
2. **Review queue**: receipts waiting for your decision.
3. **Receipts**: list filtered by month, category or merchant. Tap one to edit it.
4. **Monthly summary**: totals table, pie/bar chart and export.
5. **Settings**: categories, learned rules, backup/restore, storage used.

---

## 7. Milestones (each one shown to you before you commit)

| # | Milestone | Done when |
|---|---|---|
| 0 | Repo + plan (this file) | You approve the stack/plan |
| 1 | Scaffold: Vite + React + Tailwind + PWA + IndexedDB | App runs locally and installs on your phone |
| 2 | Live camera scanner: edge detection, auto-crop, blur check, clean image saved | A clear, flat receipt image saved from your phone |
| 3 | Tesseract OCR + receipt parser (merchant / date / total) | Sample receipts read correctly |
| 4 | Categoriser (rules + MY merchant list + keywords + local classifier) | Unit tests pass on sample receipts |
| 5 | Review queue, edit, learned rules, split, duplicates, manual entry | You can fix a wrong category in one tap and the app remembers it |
| 6 | Monthly summary + charts + CSV/Excel/PDF/ZIP export + backup/restore | Totals match a hand calculation |
| 7 | Polish: PaddleOCR comparison, budgets, deploy static app | Works on your phone over HTTPS, offline too |

## 8. Working agreement

- I (Claude) make changes locally only. **You review, commit and push.**
- After each milestone I show you the diff and how to test it.
- Real receipt photos for testing go in `samples/private/`, which is git-ignored, so they never reach GitHub.

## 9. Trade-offs of free + local

- Free OCR is less accurate than paid AI on faded or crumpled receipts. The clean-image step,
  the review queue and manual entry make up for it.
- If you clear the browser data or uninstall the app, the data is gone. Use **Backup** regularly
  (the app reminds you monthly).
- First load downloads the OCR language data (~10–20 MB). After that it works offline.
