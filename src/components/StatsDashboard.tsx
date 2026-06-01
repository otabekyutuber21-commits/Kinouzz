import React, { useEffect, useState } from "react";
import { DashboardStats } from "../types";
import { 
  Users, 
  Film, 
  Tv, 
  MessageSquareCode, 
  PlusSquare, 
  Bot, 
  Activity, 
  TrendingUp, 
  ArrowLeftRight,
  TrendingDown,
  Percent
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";

interface StatsDashboardProps {
  stats: DashboardStats | null;
  onRefresh: () => void;
}

export default function StatsDashboard({ stats, onRefresh }: StatsDashboardProps) {
  const [loading, setLoading] = useState(false);

  // Generate mock chart data to plot user signups trend nicely (last 7 days)
  const chartData = [
    { name: "Dushanba", users: (stats?.totalUsers || 0) - 25, active: 110 },
    { name: "Seshanba", users: (stats?.totalUsers || 0) - 18, active: 142 },
    { name: "Chorshanba", users: (stats?.totalUsers || 0) - 14, active: 153 },
    { name: "Payshanba", users: (stats?.totalUsers || 0) - 8, active: 164 },
    { name: "Juma", users: (stats?.totalUsers || 0) - 5, active: 198 },
    { name: "Shanba", users: (stats?.totalUsers || 0) - 2, active: 240 },
    { name: "Yakshanba", users: stats?.totalUsers || 0, active: 260 },
  ];

  // Random top genres chart
  const genreData = [
    { name: "Jangari", count: 42, color: "#06b6d4" },
    { name: "Komediya", count: 28, color: "#3b82f6" },
    { name: "Drama", count: 19, color: "#6366f1" },
    { name: "Fantastika", count: 35, color: "#8b5cf6" },
    { name: "Triller", count: 14, color: "#ec4899" },
  ];

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-white uppercase tracking-tight">
            📊 KINO BOT STATISTIKASI
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Bot ishlashi, faol a'zolar, va eng ko'p ko'rilgan kinolar tahlili
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-750 cursor-pointer self-stretch sm:self-auto justify-center"
        >
          <Activity size={14} className="animate-pulse text-cyan-400" />
          Tezkor yangilash
        </button>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">JAMI FOYDALANUVCHILAR</p>
              <h3 className="text-3xl font-bold text-white mt-2 font-mono">{stats?.totalUsers ?? 0}</h3>
            </div>
            <div className="p-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
              <Users size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
            <TrendingUp size={14} className="text-cyan-400" />
            <span className="text-cyan-400 font-semibold">+{stats?.todayUsers ?? 0}</span> bugun qo'shildi
          </p>
        </div>

        {/* Movies */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">JAMI KINOLAR</p>
              <h3 className="text-3xl font-bold text-white mt-2 font-mono">{stats?.totalMovies ?? 0}</h3>
            </div>
            <div className="p-2.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl">
              <Film size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
            <Activity size={14} className="text-cyan-400" />
            <span className="text-slate-300">{stats?.totalSerials ?? 0} ta serial</span> tizimda mavjud
          </p>
        </div>

        {/* Support requests */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">SUPPORT CHATLAR</p>
              <h3 className="text-3xl font-bold text-white mt-2 font-mono">{stats?.openSupports ?? 0}</h3>
            </div>
            <div className="p-2.5 bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded-xl">
              <MessageSquareCode size={20} />
            </div>
          </div>
          <p className="text-xs mt-4 flex items-center gap-1 text-pink-400">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping mr-1" />
            Hal qilinmagan xabarlar faol
          </p>
        </div>

        {/* Zayafkalar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">KINO SO'ROVLARI (ZAYAFKA)</p>
              <h3 className="text-3xl font-bold text-white mt-2 font-mono">{stats?.pendingRequests ?? 0}</h3>
            </div>
            <div className="p-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
              <PlusSquare size={20} />
            </div>
          </div>
          <p className="text-xs mt-4 flex items-center gap-1 text-purple-400">
            <span className="font-semibold">{stats?.pendingRequests ?? 0}</span> kutilmoqda
          </p>
        </div>
      </div>

      {/* Monitoring & Status Panel */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Bot size={22} className="animate-bounce" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">TELEGRAM BOTNING ACTIVE STATUSI</h4>
            <p className="text-xs text-slate-400 mt-0.5">Monitoring xizmati faol va bot server ulanishlarini to'liq ushlab turibdi</p>
          </div>
        </div>
        <div className="flex items-center gap-4 self-stretch md:self-auto justify-end">
          <span className="text-xs font-mono text-slate-400">Sertifikat: <b className="text-cyan-400">FAOL (SSL)</b></span>
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-full text-xs animate-pulse">
            {stats?.bot_status || "ONLINE"}
          </span>
        </div>
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Joins Chart */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">A'ZOLIK DINAMIKASI</p>
              <h4 className="text-sm font-bold text-white mt-1">Oxirgi haftalik foydalanuvchilar o'sishi</h4>
            </div>
            <span className="text-xs text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">A'zolar</span>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "10px" }}
                  labelStyle={{ color: "#94a3b8", fontSize: "12px", fontWeight: "bold" }}
                  itemStyle={{ color: "#fff", fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="users" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Favorite Genres Chart */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">TOP JANRLAR TAHLILI</p>
            <h4 className="text-sm font-bold text-white mt-1">Janrlar kesimidagi kinolar soni</h4>
          </div>

          <div className="h-64 flex flex-col justify-between">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={genreData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "8px" }}
                    itemStyle={{ color: "#fff", fontSize: "11px" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {genreData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend info */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 border-t border-slate-800/80 pt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-cyan-500 block" />
                <span>Jangari: 42</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-blue-500 block" />
                <span>Komediya: 28</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-indigo-500 block" />
                <span>Drama: 19</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-purple-500 block" />
                <span>Fantastika: 35</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom widgets: TOP MOVIES AND CHANNELS SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Most Viewed movie */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <TrendingUp size={18} />
            <span className="text-[11px] font-bold uppercase tracking-wider">REKORD KORSATKICHLAR</span>
          </div>

          <div className="space-y-3.5">
            <div>
              <p className="text-xs text-slate-400">Eng ko'p ko'rilgan film: </p>
              <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-lg border border-slate-850/50 mt-1">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold rounded font-mono">CODE: {stats?.topMovie?.code || "1001"}</span>
                  <span className="text-xs text-white font-medium">{stats?.topMovie?.title || "Titanik 3D"}</span>
                </div>
                <span className="text-xs text-slate-400 font-mono font-bold">{stats?.topMovie?.views || 1482} ko'rish</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400">Eng ko'p ko'rilgan serial: </p>
              <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-lg border border-slate-850/50 mt-1">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] font-bold rounded font-mono">CODE: {stats?.topSerial?.code || "1005"}</span>
                  <span className="text-xs text-white font-medium">{stats?.topSerial?.title || "Hokimiyat O'yinlari"}</span>
                </div>
                <span className="text-xs text-slate-400 font-mono font-bold">{stats?.topSerial?.views || 892} ko'rish</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monetization dashboard overview */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Percent size={18} />
            <span className="text-[11px] font-bold uppercase tracking-wider">KIRIM VA MONETIZATSIYA TAHLILI</span>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Botga takliflar, do'stlarni chaqirish, a'zo kilish, hamda VIP premium a'zolik taklif etish orqali loyihani moliyalashtiring.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-850/50">
                <span className="text-[10px] text-slate-500 text-slate-400 uppercase tracking-wider">Oylik o'rtacha daromad</span>
                <p className="text-emerald-400 font-bold font-mono text-sm mt-1">~500 000 UZS</p>
              </div>
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-850/50">
                <span className="text-[10px] text-slate-500 text-slate-400 uppercase tracking-wider">Sotilgan Premiumlar</span>
                <p className="text-white font-bold font-mono text-sm mt-1">12 a'zo</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
