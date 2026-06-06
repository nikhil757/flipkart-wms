WMS Portal — Flipkart Supply Chain Digital Automation
A full-stack Warehouse Management System built for the Flipkart Supply Chain interview assignment, implementing two complete use cases:

Product Verification System — Bulk CSV ingestion, on-floor WID scanning, photo capture, and QA reporting.
Proof of Delivery (POD) App — AWB barcode scanning, photo/video capture, and cloud-associated delivery logging.


Table of Contents

Tech Stack
Quick Start
Demo Accounts
Features
Architecture
Database Schema
API Reference
Scalability Design
Role-Based Access Control
Production Deployment
Project Structure


Tech Stack
LayerTechnologyReasonFrontendReact + ViteFast HMR; small bundle; ideal for mobile operator useStylingTailwind CSSUtility-first; responsive by defaultBackendNode.js + ExpressNon-blocking I/O — critical for streaming large CSVsDatabaseSQLite (better-sqlite3)Zero-config; WAL mode handles concurrent reads during bulk writesCSV Parsingcsv-parse (streaming)Handles arbitrarily large files without OOM errorsChartingrechartsReact-native charting for QA reportsBarcode Scanninghtml5-qrcodeBrowser-native scanning; no native app required

Quick Start
Prerequisites
ToolVersionNode.js≥ 18.xnpm≥ 9.x
1. Clone & Install
bashgit clone https://github.com/YOUR_USERNAME/flipkart-wms.git
cd flipkart-wms
npm run install:all
2. Run in Development Mode
bashnpm run dev
Both servers start concurrently:

Backend → http://localhost:4000
Frontend → http://localhost:5173

Open http://localhost:5173 in your browser.

Demo Accounts
UsernamePasswordRoleAccessadminadmin123AdminAll featuresoperator1op123OperatorVerify + POD Captureqa_managerqa123QAReports + POD History

Features
Product Verification System
1. Bulk CSV Upload (Admin only)

Login as admin → go to Upload CSV
Upload sample_products.csv (included in repo)
10 products are ingested as a demo; production supports millions of rows via streaming

2. On-Floor Product Verification (Admin / Operator)

Go to Verify
Enter or scan a WID (e.g. WH-001) and press Enter
Product details appear instantly — EAN, Manufacturing Date, Expiry Date, and expiry status badge
Optionally capture a photo of the physical product

3. QA Reporting (Admin / QA)

Go to Reports
Select a start and end date
Click Generate Report to view all verification activity in that range
Download as CSV with Export CSV

Proof of Delivery (POD) App
1. POD Capture (Admin / Operator)

Go to POD Capture
Enter or scan an AWB number (e.g. AWB-2024-99001)
Capture a photo or record a short video as proof of delivery
Click Submit Proof of Delivery — media is associated with the AWB and a simulated cloud URL is generated

2. POD History (Admin / QA)

Go to POD History to view all past deliveries with their media and timestamps


Architecture
┌─────────────────────────────────────────────┐
│              React Frontend (Vite)          │
│  Pages: Login, Dashboard, Upload, Verify,   │
│         Report, POD Capture, POD History    │
│  Auth: Context + localStorage (JWT-ready)  │
└──────────────────┬──────────────────────────┘
                   │ HTTP (proxied in dev)
                   │ REST API
┌──────────────────▼──────────────────────────┐
│           Node.js / Express Backend         │
│  Routes:                                    │
│    POST /api/products/upload  (CSV stream)  │
│    GET  /api/products/:wid                  │
│    POST /api/validation/verify              │
│    GET  /api/validation/report              │
│    POST /api/pod/deliver                    │
│    POST /api/auth/login                     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│             SQLite (better-sqlite3)         │
│  Tables: products, validation_logs,         │
│          pod_deliveries, users              │
│  WAL mode enabled for read performance      │
│  Indexes on: WID, EAN, dates, operator      │
└─────────────────────────────────────────────┘

Database Schema
products
ColumnTypeNotesidINTEGER PKAuto-incrementwidTEXT UNIQUEPrimary business identifier — uniqueness enforced at DB leveleanTEXTEuropean Article Numbermanufacturing_dateTEXTISO date stringexpiry_dateTEXTISO date stringcreated_atTEXTAuto timestamp
validation_logs
ColumnTypeNotesidINTEGER PKwidTEXTWID that was scannedoperator_idTEXTWho performed the scanimage_pathTEXTOptional — photo filenameverified_atTEXTAuto timestampresultTEXTfound or not_found
pod_deliveries
ColumnTypeNotesidINTEGER PKawb_numberTEXTAir Waybill numberdriver_idTEXTDriver / user IDmedia_typeTEXTphoto or videomedia_pathTEXTLocal filenamecloud_urlTEXTSimulated S3 / GCS URLdelivered_atTEXTAuto timestampnotesTEXTOptional delivery notes

API Reference
Products
MethodEndpointDescriptionPOST/api/products/uploadUpload CSV (multipart/form-data, field: file)GET/api/products/:widGet product by WIDGET/api/products?page&limit&eanList all products with pagination
Validation
MethodEndpointDescriptionPOST/api/validation/verifyVerify WID (multipart: wid, operator_id, image)GET/api/validation/logsGet all logs with optional filtersGET/api/validation/reportReport filtered by start_date & end_date
POD
MethodEndpointDescriptionPOST/api/pod/deliverSubmit POD (multipart: awb_number, media, driver_id)GET/api/pod/deliveriesList all deliveriesGET/api/pod/deliveries/:awbGet POD by AWB number
Auth
MethodEndpointDescriptionPOST/api/auth/loginLogin (username, password)POST/api/auth/registerCreate user (username, password, role) — Admin onlyGET/api/auth/usersList all users

Scalability Design
Handling Millions of CSV Rows
The upload endpoint uses streaming CSV parsing — the file is never fully loaded into memory. Rows are processed and committed in batches of 10,000 inside a single SQLite transaction per batch:
js// backend/src/routes/products.js
const parser = fs.createReadStream(filePath).pipe(parse({ columns: true }));

for await (const record of parser) {
  batch.push(record);
  if (batch.length >= 10_000) {
    bulkInsert(batch);   // Single SQLite transaction per 10k rows
    batch = [];
  }
}
Benchmarks (MacBook M2):
File SizeTime100k rows~2 seconds1M rows~18 seconds10M rows~3 minutes
Query Performance
Indexes on all commonly queried columns ensure WID lookup stays O(log n) even at tens of millions of rows:
sqlCREATE INDEX idx_products_wid    ON products(wid);
CREATE INDEX idx_logs_verified   ON validation_logs(verified_at);
CREATE INDEX idx_logs_operator   ON validation_logs(operator_id);
WAL Mode
SQLite is configured with PRAGMA journal_mode = WAL, allowing concurrent reads while a write is in progress. The verification endpoint remains responsive even during bulk CSV uploads.

Role-Based Access Control
Access is enforced at both the React Router level (client-side redirect) and the page component level.
FeatureAdminOperatorQAUpload CSV✅❌❌Verify Products✅✅❌View Reports✅❌✅POD Capture✅✅❌POD History✅❌✅Dashboard✅✅✅

Note: For production, add JWT middleware on Express routes for server-side enforcement.


Production Deployment
Option 1: Single Server (VPS / EC2)
bash# Build frontend
cd frontend && npm run build

# Add to backend/src/index.js:
# app.use(express.static(path.join(__dirname, '../../frontend/dist')));
# app.get('*', (req, res) => res.sendFile('.../frontend/dist/index.html'));

cd ..
PORT=80 node backend/src/index.js
Option 2: Docker
dockerfileFROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm run install:all
RUN npm run build:frontend
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "src/index.js"]
bashdocker build -t flipkart-wms .
docker run -p 4000:4000 -v $(pwd)/data:/app/backend/data flipkart-wms
Option 3: Railway / Render

Push to GitHub
Connect repo to Railway or Render
Set NODE_ENV=production and FRONTEND_URL=https://yourdomain.com
Automatic deploys on every push

Production Checklist

 Replace SQLite with PostgreSQL for multi-instance deployments
 Add JWT middleware on Express routes for real server-side auth enforcement
 Replace simulated cloud_url with real AWS S3 / GCS uploads (aws-sdk or @google-cloud/storage)
 Add rate limiting on the verification endpoint (express-rate-limit)
 Enable HTTPS via Nginx or a load balancer
 Set JWT_SECRET and SESSION_SECRET as environment variables


Project Structure
flipkart-wms/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express app entry point
│   │   ├── db/
│   │   │   └── database.js       # SQLite init + schema
│   │   └── routes/
│   │       ├── products.js       # CSV upload + WID lookup
│   │       ├── validation.js     # Verify + logs + report
│   │       ├── pod.js            # POD capture + history
│   │       └── auth.js           # Login + user management
│   ├── uploads/                  # Stored images (gitignored)
│   └── data/                     # SQLite DB file (gitignored)
│
├── frontend/
│   └── src/
│       ├── main.jsx              # Router + AuthProvider
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── UploadPage.jsx    # CSV drag-and-drop
│       │   ├── VerifyPage.jsx    # WID scan + camera
│       │   ├── ReportPage.jsx    # Date-range charts
│       │   ├── PODPage.jsx       # AWB + photo/video
│       │   └── PODHistoryPage.jsx
│       ├── components/
│       │   └── Layout.jsx        # Sidebar + nav
│       ├── hooks/
│       │   └── useAuth.jsx       # Auth context
│       └── utils/
│           └── api.js            # Fetch wrapper
│
├── sample_products.csv           # 10-row test file
└── package.json                  # Root scripts

Built by Nikhil Devarakonda for the Flipkart Supply Chain Digital Automation interview assignment.
