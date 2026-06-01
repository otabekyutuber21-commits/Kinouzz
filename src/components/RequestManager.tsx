import React, { useState, useEffect } from "react";
import { MovieRequest } from "../types";
import { PlusSquare, Check, X, Search, Clock, HelpCircle, MessageSquare } from "lucide-react";

interface RequestManagerProps {
  adminId: string;
}

export default function RequestManager({ adminId }: RequestManagerProps) {
  const [requests, setRequests] = useState<MovieRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Resolving modal states
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveType, setResolveType] = useState<"Bajarildi" | "Rad etildi">("Bajarildi");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/requests");
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingId) return;

    try {
      const res = await fetch("/api/requests/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: resolvingId,
          status: resolveType,
          admin_notes: notes.trim(),
          adminId
        })
      });
      if (res.ok) {
        setResolvingId(null);
        setNotes("");
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredRequests = requests.filter((r) => {
    return r.movie_title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           r.user_id.includes(searchQuery);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white uppercase tracking-tight">📝 MIJOZ KINO SO'ROVLARI (ZAYAFKALAR)</h1>
        <p className="text-xs text-slate-400 mt-1">
          Foydalanuvchilar qidirib topolmagan kinolarni so'rashganda kelib tushadigan zayafkalar va so'rovlar oqimi
        </p>
      </div>

      {/* Search Input */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-2">
        <Search size={18} className="text-slate-500 shrink-0" />
        <input
          type="text"
          placeholder="Kino nomi yoki foydalanuvchi telegram ID si orqali qidiruv..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none w-full"
        />
      </div>

      {/* Requests table listing */}
      {loading ? (
        <p className="text-xs text-slate-400 text-center py-10">Ma'lumotlar yuklanmoqda...</p>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/10 rounded-xl border border-slate-800/50 text-slate-500 text-xs">
          Hech qanday zayafka topilmadi.
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                <th className="p-4">So'rov kodi</th>
                <th className="p-4">Mijoz (Telegram ID)</th>
                <th className="p-4">Talab etilgan kino nomi</th>
                <th className="p-4">Sana</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/40 text-slate-300">
              {filteredRequests.map((req) => {
                const date = new Date(req.created_at).toLocaleDateString("UZ-uz");
                const time = new Date(req.created_at).toLocaleTimeString("UZ-uz", { hour: "2-digit", minute: "2-digit" });

                return (
                  <tr key={req.id} className="hover:bg-slate-900/10 transition">
                    <td className="p-4 font-mono font-bold text-slate-400">#REQ{req.id}</td>
                    <td className="p-4">
                      <span className="font-semibold text-white">@{req.username || "username_yoq"}</span>
                      <span className="text-slate-500 font-mono block mt-0.5">ID: {req.user_id}</span>
                    </td>
                    <td className="p-4 font-bold text-slate-200">{req.movie_title}</td>
                    <td className="p-4 text-slate-400">{date} • {time}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[9px] uppercase ${
                        req.status === "Kutilmoqda" 
                          ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" 
                          : req.status === "Bajarildi" 
                            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                            : "bg-red-500/10 border border-red-500/20 text-red-400"
                      }`}>
                        {req.status === "Kutilmoqda" ? "🟡 Kutilmoqda" : req.status === "Bajarildi" ? "🟢 Bajarildi" : "🔴 Rad etildi"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {req.status === "Kutilmoqda" ? (
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => { setResolvingId(req.id); setResolveType("Bajarildi"); }}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 py-1 px-2 rounded font-semibold cursor-pointer"
                          >
                            Qabul qilish
                          </button>
                          <button
                            onClick={() => { setResolvingId(req.id); setResolveType("Rad etildi"); }}
                            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-1 px-2 rounded font-semibold cursor-pointer"
                          >
                            Rad etish
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px] leading-relaxed block italic max-w-xs ml-auto">
                          Izoh: {req.admin_notes || "izoh qoldirilmagan."}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* RESOLVING MODAL COMPONENT */}
      {resolvingId !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                So'rov xatolarini to'ldiring: #REQ{resolvingId} ({resolveType})
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Foydalanuvchiga yuboradigan javob xabaringiz va izohlaringizni kiriting.
              </p>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">Admin javobi / izohi</label>
                <textarea
                  required
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={resolveType === "Bajarildi" 
                    ? "Forsaj 10 kinosi botga qo'shildi! Kino kodi: 1004" 
                    : "Afsuski, ushbu kino internetda topilmadi yoki sifatsiz ekan"
                  }
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                />
                <span className="text-[10px] text-slate-500 block mt-1 leading-relaxed">
                  * Ushbu xabar mijozga bot orqali shaxsiy xabar (direct message) shaklida yetkaziladi!
                </span>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setResolvingId(null)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 py-1.5 px-4 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className={`py-1.5 px-4 rounded-xl text-xs font-semibold text-white tracking-wide cursor-pointer ${
                    resolveType === "Bajarildi" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
                  }`}
                >
                  Saqlash va Yuborish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
