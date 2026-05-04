import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/rooms", label: "預約會議室", icon: "🏢" },
  { to: "/holidays", label: "香港假期同步", icon: "📅" },
  { to: "/birthdays", label: "生日快樂祝福", icon: "🎂" },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-gray-700">
          <span className="text-lg font-bold tracking-tight">Lark Assistant</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-lark-blue text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
