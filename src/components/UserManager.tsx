import React, { useState, useEffect } from "react";
import { User } from "../types";
import { Search, UserCheck, ShieldAlert, Star, Shield, Ban, CheckCircle2 } from "lucide-react";

interface UserManagerProps {
  adminId: string;
}

export default function UserManager({ adminId }: UserManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBanToggle = async (userId: string, isCurrentlyBanned: boolean) => {
    const endpoint = isCurrentlyBanned ? "/api/users/unban" : "/api/users/ban";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, adminId })
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePremiumToggle = async (userId: string, isCurrentlyPremium: boolean) => {
    try {
      const res = await fetch("/api/users/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, is_premium: !isCurrentlyPremium, adminId })
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredUsers = users.filter((u) => {
    return u.id.includes(searchQuery) || 
           (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
           (u.first_name && u.first_name.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white uppercase tracking-tight">👤 FOYDALANUVCHILARNI BOSHQRISH</h1>
        <p className="text-xs text-slate-400 mt-1">
          Bot obunachilar ro'yxati, referallar soni, ban qilish hamda VIP premium a'zolik huquqlarini ulashish paneli
        </p>
      </div>

      {/* Search query */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-2">
        <Search size={18} className="text-slate-500 shrink-0" />
        <input
          type="text"
          placeholder="Foydalanuvchi ismi, username yoki telegram ID si orqali qidirish..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none w-full"
        />
      </div>

      {/* Users representation list */}
      {loading ? (
        <p className="text-xs text-slate-400 text-center py-10">Foydalanuvchilar ro'yxati yuklanmoqda...</p>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/10 rounded-xl border border-slate-800/50 text-slate-500 text-xs">
          Hech qanday obunachi topilmadi.
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                <th className="p-4">Tashrifchi ID</th>
                <th className="p-4">Ism / Nickname</th>
                <th className="p-4">Qo'shilgan sana</th>
                <th className="p-4">Referallari</th>
                <th className="p-4">VIP Premium</th>
                <th className="p-4">Taqiq (Ban)</th>
                <th className="p-4 text-right">Tezkor amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/40 text-slate-300">
              {filteredUsers.map((u) => {
                const joinedDate = new Date(u.joined_at).toLocaleDateString("UZ-uz");

                return (
                  <tr key={u.id} className={`hover:bg-slate-900/10 transition ${u.is_banned ? "opacity-60 bg-red-950/5" : ""}`}>
                    <td className="p-4 font-mono font-bold text-slate-400">`{u.id}`</td>
                    <td className="p-4">
                      <span className="font-semibold text-white block">{u.first_name || "Noma'lum Ism"}</span>
                      {u.username ? (
                        <a href={`https://t.me/${u.username}`} target="_blank" rel="noreferrer" className="text-cyan-400 font-medium hover:underline text-[11px] block mt-0.5">
                          @{u.username}
                        </a>
                      ) : (
                        <span className="text-slate-600 block mt-0.5 text-[10px]">Usernamesiz</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-400">{joinedDate}</td>
                    <td className="p-4 font-bold font-mono text-cyan-400">{u.referrals_count} ta</td>
                    <td className="p-4">
                      {u.is_premium ? (
                        <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold rounded-full text-[9px] flex items-center gap-1 w-max">
                          <Star size={10} className="fill-cyan-400" />
                          PREMIUM
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Oddiy</span>
                      )}
                    </td>
                    <td className="p-4">
                      {u.is_banned ? (
                        <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 font-bold rounded-full text-[9px] flex items-center gap-1 w-max">
                          <Ban size={10} />
                          BLOKLANGAN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold rounded-full text-[9px] flex items-center gap-1 w-max">
                          <UserCheck size={10} />
                          RUHSAT ETILGAN
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => handlePremiumToggle(u.id, u.is_premium)}
                          className={`py-1 px-2.5 rounded font-semibold text-[10px] cursor-pointer border ${
                            u.is_premium 
                              ? "bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-750" 
                              : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/20"
                          }`}
                        >
                          {u.is_premium ? "VIP o'chirish" : "VIP Premium qilish"}
                        </button>
                        <button
                          onClick={() => handleBanToggle(u.id, u.is_banned)}
                          className={`py-1 px-2.5 rounded font-semibold text-[10px] cursor-pointer border ${
                            u.is_banned 
                              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20" 
                              : "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20"
                          }`}
                        >
                          {u.is_banned ? "Blokdan olish" : "Bloklash"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
