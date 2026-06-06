import { useState } from "react";
import { BarChart3, Download, Search, TrendingUp, Users, CheckCircle, XCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line
} from "recharts";
import toast from "react-hot-toast";
import { format, subDays } from "date-fns";

export default function ReportPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    if (!startDate || !endDate) { toast.error("Select a date range"); return; }
    if (new Date(startDate) > new Date(endDate)) { toast.error("Start date must be before end date"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/validation/report?start_date=${startDate}&end_date=${endDate}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!report) return;
    const headers = ["ID", "WID", "EAN", "Operator", "Result", "Verified At", "Mfg Date", "Expiry Date"];
    const rows = report.details.map((d) => [
      d.id, d.wid, d.ean || "", d.operator_id, d.result, d.verified_at,
      d.manufacturing_date || "", d.expiry_date || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verification_report_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded!");
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Verification Reports</h1>
          <p className="text-gray-500 text-sm mt-1">QA analytics for compliance tracking</p>
        </div>
        {report && (
          <button onClick={downloadCSV} className="btn-secondary text-sm">
            <Download size={14} />
            Export CSV
          </button>
        )}
      </div>

      {/* Date Range Picker */}
      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              className="input w-44"
              value={startDate}
              max={today}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              className="input w-44"
              value={endDate}
              max={today}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button onClick={fetchReport} disabled={loading} className="btn-primary">
            <Search size={14} />
            {loading ? "Generating…" : "Generate Report"}
          </button>

          {/* Quick range shortcuts */}
          <div className="flex gap-2 ml-auto">
            {[
              { label: "Today", days: 0 },
              { label: "7d", days: 7 },
              { label: "30d", days: 30 },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => {
                  setStartDate(format(subDays(new Date(), days), "yyyy-MM-dd"));
                  setEndDate(today);
                }}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600 font-medium"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Report content */}
      {report && (
        <div className="space-y-6 fade-in">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Total Verifications", value: report.summary.total_verifications, icon: BarChart3, color: "text-brand-500" },
              { label: "Successful", value: report.summary.successful, icon: CheckCircle, color: "text-green-500" },
              { label: "Not Found", value: report.summary.failed, icon: XCircle, color: "text-red-500" },
              { label: "Unique Products", value: report.summary.unique_products_checked, icon: TrendingUp, color: "text-blue-500" },
              { label: "Operators Active", value: report.summary.unique_operators, icon: Users, color: "text-purple-500" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="stat-card">
                <Icon size={16} className={color} />
                <div className="text-2xl font-bold text-gray-900 mt-1">{value ?? 0}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          {/* Chart: Daily activity */}
          {report.byDay?.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-800 text-sm mb-4">Daily Verification Activity</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={report.byDay} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Bar dataKey="total" fill="#f87316" name="Total" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="found" fill="#22c55e" name="Found" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-operator breakdown */}
          {report.byOperator?.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-800 text-sm mb-4">Operator Activity</h3>
              <div className="space-y-2">
                {report.byOperator.map((op) => (
                  <div key={op.operator_id} className="flex items-center gap-3">
                    <div className="w-24 text-sm font-medium text-gray-700 truncate">{op.operator_id}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${Math.min(100, (op.found / (op.total || 1)) * 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 w-20 text-right">
                      {op.found}/{op.total} found
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detail table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">
                Verification Log ({report.details.length} entries)
              </h3>
              {report.details.length === 500 && (
                <span className="text-xs text-gray-400">Showing first 500 — export CSV for full list</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["WID", "EAN", "Operator", "Result", "Verified At", "Expiry"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.details.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs font-medium">{row.wid}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{row.ean || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{row.operator_id}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                          ${row.result === "found" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {row.result === "found" ? "✓ Found" : "✗ Not Found"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {new Date(row.verified_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{row.expiry_date || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
