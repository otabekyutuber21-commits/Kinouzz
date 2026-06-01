import React, { useState, useEffect } from "react";
import { 
  BarChart, 
  Film, 
  Tv, 
  Megaphone, 
  PlusSquare, 
  MessageSquare, 
  Lock, 
  Terminal, 
  Users, 
  Settings, 
  LogOut, 
  Bot, 
  Activity, 
  Bell, 
  ShieldCheck, 
  Menu, 
  X,
  Sparkles,
  HelpCircle,
  EyeOff
} from "lucide-react";
import Login from "./components/Login";
import StatsDashboard from "./components/StatsDashboard";
import MovieManager from "./components/MovieManager";
import SerialManager from "./components/SerialManager";
import ChannelManager from "./components/ChannelManager";
import RequestManager from "./components/RequestManager";
import SupportChat from "./components/SupportChat";
import AdBroadcast from "./components/AdBroadcast";
import UserManager from "./components/UserManager";
import SettingsManager from "./components/SettingsManager";
import LogsViewer from "./components/LogsViewer";
import AdminManager from "./components/AdminManager";
import { DashboardStats } from "./types";

type TabName = 
  | "stats" 
  | "movies" 
  | "serials" 
  | "channels" 
  | "requests" 
  | "support" 
  | "ads" 
  | "admins" 
  | "settings" 
  | "logs" 
  | "users";

export default function App() {
  const [adminId, setAdminId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>("stats");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Poll stats details
  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error("Failed to load statistics: ", e);
    }
  };

  useEffect(() => {
    // Detect and expand Telegram WebApp if loaded inside Telegram
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready?.();
      tg.expand?.();
      const tgUser = tg.initDataUnsafe?.user;
      if (tgUser && tgUser.id) {
        // Auto-verify if they are registered as administrators
        const verifyAndLogin = async () => {
          try {
            const res = await fetch(`/api/auth/verify-telegram-admin?admin_id=${tgUser.id}`);
            if (res.ok) {
              const data = await res.json();
              if (data.success) {
                localStorage.setItem("admin_id", String(tgUser.id));
                localStorage.setItem("admin_token", data.token);
                setAdminId(String(tgUser.id));
                return;
              }
            }
          } catch (err) {
            console.warn("Telegram WebApp auto login failed:", err);
          }
        };
        verifyAndLogin();
      }
    }

    const savedAdminId = localStorage.getItem("admin_id");
    const savedToken = localStorage.getItem("admin_token");
    if (savedAdminId && savedToken) {
      setAdminId(savedAdminId);
    }
  }, []);

  useEffect(() => {
    if (adminId) {
      fetchStats();
      const statsInterval = setInterval(fetchStats, 10000); // refresh statistics every 10s
      return () => clearInterval(statsInterval);
    }
  }, [adminId]);

  const handleLogout = () => {
    localStorage.removeItem("admin_id");
    localStorage.removeItem("admin_token");
    setAdminId(null);
  };

  if (!adminId) {
    return <Login onLoginSuccess={(id) => setAdminId(id)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "stats":
        return <StatsDashboard stats={stats} onRefresh={fetchStats} />;
      case "movies":
        return <MovieManager adminId={adminId} />;
      case "serials":
        return <SerialManager adminId={adminId} />;
      case "channels":
        return <ChannelManager adminId={adminId} />;
      case "requests":
        return <RequestManager adminId={adminId} />;
      case "support":
        return <SupportChat adminId={adminId} adminName="Asosiy Ma'mur" />;
      case "ads":
        return <AdBroadcast adminId={adminId} />;
      case "admins":
        return <AdminManager adminId={adminId} />;
      case "settings":
        return <SettingsManager adminId={adminId} />;
      case "logs":
        return <LogsViewer />;
      case "users":
        return <UserManager adminId={adminId} />;
      default:
        return <StatsDashboard stats={stats} onRefresh={fetchStats} />;
    }
  };

  const menuItems = [
    { name: "stats", label: "📊 Statistika", icon: BarChart },
    { name: "movies", label: "🎬 Kino boshqaruvi", icon: Film },
    { name: "serials", label: "📺 Serial boshqaruvi", icon: Tv },
    { name: "channels", label: "📺 Kanallar", icon: ShieldCheck },
    { name: "requests", label: "📝 Zayafkalar", icon: PlusSquare },
    { name: "support", label: "💬 Support", icon: MessageSquare },
    { name: "ads", label: "📢 Reklama", icon: Megaphone },
    { name: "users", label: "👥 Foydalanuvchilar", icon: Users },
    { name: "admins", label: "👮 Adminlar", icon: Lock },
    { name: "settings", label: "⚙️ Sozlamalar & Backup", icon: Settings },
    { name: "logs", label: "📜 Loglar", icon: Terminal },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Background glow canvas */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-cyan-950/15 via-transparent to-transparent pointer-events-none" />

      {/* TOP HEADER */}
      <header className="bg-slate-900/45 backdrop-blur-md border-b border-slate-900 px-4 py-3 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 hover:bg-slate-800 rounded-lg md:hidden text-slate-400 hover:text-white transition cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-600/10 text-cyan-400 border border-cyan-500/20 rounded-lg">
              <Bot size={18} className="animate-pulse" />
            </span>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white font-sans">KINO PLATFORMA DASHBOARD</h1>
              <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Dastur: {stats?.bot_status || "YUKLANMOQDA"}
              </span>
            </div>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3.5">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 border border-slate-800 bg-slate-950/50 px-2.5 py-1.5 rounded-lg">
            <Sparkles size={11} className="text-cyan-400 font-bold" />
            <span>Ma'mur:</span>
            <span className="text-white font-semibold font-mono text-[11px] bg-slate-900 px-1 py-0.5 rounded border border-slate-800">`{adminId}`</span>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-red-500/10"
            title="Tizimdan chiqish"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Chiqish</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-stretch">
        {/* MOBILE SIDEBAR MOBILE DRAWER */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <div className="relative flex flex-col w-64 max-w-xs bg-slate-900 border-r border-slate-800 h-full p-5 space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kino Bot menyusi</span>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <nav className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeTab === item.name;

                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        setActiveTab(item.name as any);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                        isSelected 
                          ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/10" 
                          : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* SIDEBAR NAVIGATION (DESKTOP) */}
        <aside className="w-64 bg-slate-900/15 border-r border-slate-900/60 p-4 shrink-0 hidden md:flex flex-col justify-between">
          <nav className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-3">Tizim bo'limlari</p>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.name;

              return (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(item.name as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isSelected 
                      ? "bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 font-bold" 
                      : "text-slate-400 hover:text-white hover:bg-slate-900/30 border border-transparent"
                  }`}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          
          <div className="border-t border-slate-900 pt-4 text-[10.5px] text-slate-500 space-y-1 hover:text-slate-400 transition">
            <p className="font-semibold text-slate-400 mt-1">Sertifikatlangan Kino Bot</p>
            <p className="leading-normal">Poling, to'liq mudofaa, majburiy obuna va loglar tizimi sozlangan.</p>
          </div>
        </aside>

        {/* CENTRAL WORK AREA */}
        <main className="flex-1 p-5 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
