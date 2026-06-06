import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PackageSearch, Upload, ScanLine, BarChart3, Truck, AlertTriangle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../utils/api";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    // Fetch recent validation logs for dashboard
    api.get("/validation/logs?limit=5")
      .then((d) => setRecentLogs(d.logs || []))
      .catch(() => {});

    // Build stats from available data
    api.get("/validation/logs?limit=1")
      .then((d) => {
        setStats((prev) => ({ ...prev, totalVerifications: d.total }));
      })
      .catch(() => {});

    api.get("/products?limit=1")
      .then((d) => {
        setStats((prev) => ({ ...prev, totalProducts: d.total }));
      })
      .catch(() => {});

    api.get("/pod/deliveries?limit=1")
      .then((d) => {
        setStats((prev) => ({ ...prev, totalPOD: d.total }));
      })
      .catch(() => {});
  }, []);

  const quickActions = [
    user.role !== "qa" && {
      to: "/verify",
      icon: ScanLine,
      label: "Verify Product",
      desc: "Scan WID and validate",
      color: "bg-blue-500",
      bg: "bg-blue-50",
    },
    user.role === "admin" && {
      to: "/upload",
      icon: Upload,
      label: "Upload CSV",
      desc: "Bulk product ingestion",
      color: "bg-brand-500",
      bg: "bg-brand-50",
    },
    (user.role === "admin" || user.role === "qa") && {
      to: "/report",
      icon: BarChart3,
      label: "View Reports",
      desc: "Verification analytics",
      color: "bg-purple-500",
      bg: "bg-purple-50",
    },
    user.role !== "qa" && {
      to: "/pod",
      icon: Truck,
      label: "Log Delivery",
      desc: "Proof of delivery",
      color: "bg-green-500",
      bg: "bg-green-50",
    },
  ].filter(Boolean);

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getGreeting()}, {user.username} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Warehouse Management System – Supply Chain Digital Automation
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Products Indexed", value: stats?.totalProducts ?? "—", icon: PackageSearch, color: "text-brand-500" },
          { label: "Verifications", value: stats?.totalVerifications ?? "—", icon: ScanLine, color: "text-blue-500" },
          { label: "POD Logged", value: stats?.totalPOD ?? "—", icon: Truck, color: "text-green-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <Icon size={20} className={color} />
            <div className="text-2xl font-bold text-gray-900 mt-2">{value?.toLocaleString()}</div>
            <div className="text-xs text-gray-500 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(({ to, icon: Icon, label, desc, color, bg }) => (
            <Link
              key={to}
              to={to}
              className="card p-5 flex items-center gap-4 hover:shadow-md transition-all hover:-translate-y-0.5"
            >
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
                <Icon size={18} className={color.replace("bg-", "text-")} />
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{label}</div>
                <div className="text-xs text-gray-500">{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Verifications */}
      {recentLogs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Verifications</h2>
            {(user.role === "admin" || user.role === "qa") && (
              <Link to="/report" className="text-xs text-brand-600 font-medium hover:underline">
                View all →
              </Link>
            )}
          </div>
          <div className="card divide-y divide-gray-50">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      log.result === "found" ? "bg-green-400" : "bg-red-400"
                    }`}
                  />
                  <div>
                    <div className="font-mono text-sm font-medium">{log.wid}</div>
                    <div className="text-xs text-gray-400">{log.operator_id}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-semibold ${log.result === "found" ? "text-green-600" : "text-red-500"}`}>
                    {log.result === "found" ? "✓ Verified" : "✗ Not Found"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(log.verified_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
