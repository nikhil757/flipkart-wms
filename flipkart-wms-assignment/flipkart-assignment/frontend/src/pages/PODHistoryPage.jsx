import { useEffect, useState } from "react";
import { History, Search } from "lucide-react";
import { format, subDays } from "date-fns";

export default function PODHistoryPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [awbFilter, setAwbFilter] = useState("");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(today);
  const [deliveries, setDeliveries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetchDeliveries = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (awbFilter) params.set("awb", awbFilter);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    try {
      const res = await fetch(`/api/pod/deliveries?${params}`);
      const data = await res.json();
      setDeliveries(data.deliveries || []);
      setTotal(data.total || 0);
    } catch {
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDeliveries(); }, [page]);

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">POD History</h1>
        <p className="text-gray-500 text-sm mt-1">All proof-of-delivery records</p>
      </div>

      {/* Filters */}
      <div className="card p-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">AWB Search</label>
          <input
            className="input w-48"
            placeholder="Search AWB…"
            value={awbFilter}
            onChange={(e) => setAwbFilter(e.target.value)}
          />
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input w-40" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input w-40" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <button onClick={() => { setPage(1); fetchDeliveries(); }} className="btn-primary">
          <Search size={14} /> Filter
        </button>
        <span className="text-sm text-gray-500 ml-auto">{total} total records</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["ID", "AWB Number", "Driver", "Type", "Delivered At", "Notes", "Media"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : deliveries.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No deliveries found</td></tr>
              ) : (
                deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400">#{d.id}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-sm">{d.awb_number}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{d.driver_id}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
                        ${d.media_type === "photo" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {d.media_type === "photo" ? "📸 Photo" : "🎥 Video"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(d.delivered_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">{d.notes || "—"}</td>
                    <td className="px-4 py-3">
                      {d.media_path && (
                        <a
                          href={`/api/pod/media/${d.media_path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-brand-600 hover:underline font-medium"
                        >
                          View →
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1.5 px-3">
                ← Prev
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="btn-secondary text-xs py-1.5 px-3">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
