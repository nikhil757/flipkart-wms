import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  ScanLine,
  BarChart3,
  Truck,
  History,
  LogOut,
  PackageSearch,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { to: "/",          icon: LayoutDashboard, label: "Dashboard",    roles: ["admin", "operator", "qa"] },
  { to: "/upload",    icon: Upload,          label: "Upload CSV",   roles: ["admin"] },
  { to: "/verify",    icon: ScanLine,        label: "Verify",       roles: ["admin", "operator"] },
  { to: "/report",    icon: BarChart3,       label: "Reports",      roles: ["admin", "qa"] },
  { to: "/pod",       icon: Truck,           label: "POD Capture",  roles: ["admin", "operator"] },
  { to: "/pod/history", icon: History,       label: "POD History",  roles: ["admin", "qa"] },
];

const roleColors = {
  admin:    "bg-brand-100 text-brand-700",
  operator: "bg-blue-100 text-blue-700",
  qa:       "bg-purple-100 text-purple-700",
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const visibleNav = navItems.filter((n) => n.roles.includes(user?.role));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col shrink-0 shadow-sm">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <PackageSearch size={18} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 leading-tight">WMS Portal</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">Flipkart SCM</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                 ${isActive
                   ? "bg-brand-50 text-brand-600 font-semibold"
                   : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                 }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 uppercase">
              {user?.username?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800 truncate">{user?.username}</div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${roleColors[user?.role] || "bg-gray-100 text-gray-600"}`}>
                {user?.role}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors px-1 py-1">
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
