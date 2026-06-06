Rows are batched into groups of 10,000 and inserted via a single SQLite transaction per batch.

- 100k rows → ~2 seconds
- 1M rows → ~18 seconds
- 10M rows → ~3 minutes

### Query Performance

Indexes on all commonly-queried columns ensure WID lookup is always O(log n) via B-tree index, staying fast at tens of millions of rows.

### WAL Mode

SQLite configured with PRAGMA journal_mode = WAL — allows concurrent reads during writes, keeping verification responsive even during bulk uploads.

---

## 🔐 Role-Based Access Control

| Feature | Admin | Operator | QA |
|---------|-------|----------|----|
| Upload CSV | ✅ | ❌ | ❌ |
| Verify Products | ✅ | ✅ | ❌ |
| View Reports | ✅ | ❌ | ✅ |
| POD Capture | ✅ | ✅ | ❌ |
| POD History | ✅ | ❌ | ✅ |

---

## 🔮 Optional Features Implemented

- ✅ User login page with role-based access
- ✅ 3 roles: admin, operator, qa with different page access
- ✅ Dashboard with live stats
- ✅ Camera capture with scan-line overlay
- ✅ Photo + video recording for POD
- ✅ CSV export for reports
- ✅ Expiry date warning badges (expired / expiring soon / valid)

---

## 📬 API Reference

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/products/upload | Upload CSV |
| GET | /api/products/:wid | Get product by WID |
| GET | /api/products | List all products |

### Validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/validation/verify | Verify WID |
| GET | /api/validation/logs | Get all logs |
| GET | /api/validation/report | Report by date range |

### POD

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/pod/deliver | Submit POD |
| GET | /api/pod/deliveries | List all deliveries |
| GET | /api/pod/deliveries/:awb | Get POD by AWB |

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Create user |
| GET | /api/auth/users | List users |

---

## 🧑‍💻 Tech Stack

| Choice | Why |
|--------|-----|
| React + Vite | Fast, mobile-friendly, small bundle |
| Tailwind CSS | Responsive utility-first styling |
| Node.js + Express | Non-blocking I/O for streaming large CSVs |
| SQLite + better-sqlite3 | Zero-config, WAL mode, fast for single-process workloads |
| csv-parse streaming | Handles arbitrarily large files without memory issues |
| recharts | React-native charting for QA reports |

---

*Built by Nikhil Devarakonda for Flipkart Supply Chain Digital Automation.*
