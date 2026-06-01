import React, { useState, useEffect } from "react";
import { Plus, Trash2, Shield, UserX, Crown, HelpCircle } from "lucide-react";

interface AdminManagerProps {
  adminId: string;
}

export default function AdminManager({ adminId }: AdminManagerProps) {
  const [admins, setAdmins] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAdmin, setNewAdmin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admins");
      const data = await res.json();
      setAdmins(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.trim()) return;

    setError(null);
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newAdminId: newAdmin.trim(), adminId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Admin qo'shishda xatolik yuz berdi");
      }

      setNewAdmin("");
      fetchAdmins();
    } catch (err: any) {
      setError(err.message || "Xatolik");
    }
  };

  const handleRemoveAdmin = async (targetId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admins/${targetId}?adminId=${adminId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Admin o'chirishda xatolik yuz berdi");
      }
      fetchAdmins();
    } catch (err: any) {
      setError(err.message || "Xatolik");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white uppercase tracking-tight">👮 ADMINLAR VA HUQUQLAR (PRIVILEGES)</h1>
        <p className="text-xs text-slate-400 mt-1">Bot paneliga, sozlamalarga va kino qo'shish jabhaga ruxsati bo'lgan ma'murlar va super-adminlar ro'yxati</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD NEW ADMIN FORM */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4 self-start">
          <div className="flex items-center gap-2 text-cyan-400">
            <Plus size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Yangi admin qo'shish</span>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleAddAdmin} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Foydalanuvchi Telegram ID si</label>
              <input
                type="text"
                required
                value={newAdmin}
                onChange={(e) => setNewAdmin(e.target.value)}
                placeholder="Masalan: 582938491"
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
              />
              <span className="text-[10px] text-slate-500 block mt-1 leading-relaxed">
                * Qo'shilayotgan shaxs botimizga /start bergan hamda asliga ID si to'g'ri bo'lishi talab etiladi.
              </span>
            </div>

            <button
              type="submit"
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              Ruxsat Berish
            </button>
          </form>
        </div>

        {/* ACTIVE ADMINS LIST */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 text-purple-400">
            <Shield size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Tizim Ma'murlari ro'yxati</span>
          </div>

          {loading ? (
            <p className="text-xs text-slate-400 text-center py-4">Yuklanmoqda...</p>
          ) : (
            <div className="space-y-3">
              {admins.map((id) => {
                const isSuper = id === "8939863862";

                return (
                  <div key={id} className="bg-slate-950/60 border border-slate-850/60 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 border rounded-xl ${
                        isSuper ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                      }`}>
                        {isSuper ? <Crown size={16} /> : <Shield size={16} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-mono font-bold text-white">`{id}`</h4>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {isSuper ? "🌟 ASOSIY SUPER ADMINISTRATOR (Eshigi Qulflangan)" : "👮 QO'SHIMCHA MA'MUR"}
                        </span>
                      </div>
                    </div>

                    {!isSuper && (
                      <button
                        onClick={() => handleRemoveAdmin(id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-lg transition shrink-0 cursor-pointer"
                        title="Huquqini olib tashlash"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
