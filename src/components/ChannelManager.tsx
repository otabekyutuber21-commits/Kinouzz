import React, { useState, useEffect } from "react";
import { MandatoryChannel } from "../types";
import { Plus, Trash2, HelpCircle, Check, Star, Globe, ShieldCheck, Megaphone, Users, Lock, Youtube, Instagram } from "lucide-react";

interface ChannelManagerProps {
  adminId: string;
}

export default function ChannelManager({ adminId }: ChannelManagerProps) {
  const [channels, setChannels] = useState<MandatoryChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [type, setType] = useState<MandatoryChannel["type"]>("channel");

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/channels");
      const data = await res.json();
      setChannels(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setError(null);
    const payload = {
      name: name.trim(),
      url: url.trim(),
      telegram_id: telegramId.trim(),
      type,
      adminId
    };

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Xatolik yuz berdi");
      }

      setName("");
      setUrl("");
      setTelegramId("");
      setType("channel");
      fetchChannels();
    } catch (err: any) {
      setError(err.message || "Xatolik");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/channels/${id}?adminId=${adminId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchChannels();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white uppercase tracking-tight">📺 MAJBURIY OBUNALAR (KANALLAR)</h1>
        <p className="text-xs text-slate-400 mt-1">
          Foydalanuvchilar qidiruvdan foydalanishi uchun a'zo bo'lishlari shart bo'lgan kanallar va ijtimoiy havolalar
        </p>
      </div>

      {/* Grid: Admin creator form & active list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD CHANNELS FORM CARD */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4 self-start">
          <div className="flex items-center gap-2 text-cyan-400">
            <Plus size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Yangi kanal biriktirish</span>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Kanal/Guruh Nomi</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: KinoDunyo | Rasmiy"
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Havola URL (Taklif havolasi)</label>
              <input
                type="text"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://t.me/+9ZBsQu1y7VE4YmEy"
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Telegram Id yoki @Username</label>
              <input
                type="text"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="Masalan: -100xxxxxxxxxx"
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Obunani tekshirish uchun bot kanal yoki guruhda *ADMIN* bo'lishi shart!</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Platforma Turi</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 select-sm"
              >
                <option value="channel">Telegram Kanal (Ochiq)</option>
                <option value="group">Telegram Guruh (Ochiq)</option>
                <option value="private">Telegram Xususiy / Yopiq Kanal/Guruh</option>
                <option value="instagram">Instagram Profil (Havola)</option>
                <option value="youtube">YouTube Kanal (Havola)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-xl text-xs transition duration-150 cursor-pointer text-center"
            >
              Kanalni qo'shish
            </button>
          </form>
        </div>

        {/* ACTIVE CHANNELS LIST */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 text-purple-400">
            <ShieldCheck size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Hozirda faol kanallar ro'yxati</span>
          </div>

          {loading ? (
            <p className="text-xs text-slate-400 py-4 text-center">Yuklanmoqda...</p>
          ) : channels.length === 0 ? (
            <p className="text-xs text-slate-500 py-12 text-center italic">Hech qanday majburiy kanal qo'shilmagan. Bot barcha a'zolarga cheklovsiz start oladi.</p>
          ) : (
            <div className="space-y-3">
              {channels.map((chan) => {
                let iconColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
                if (chan.type === "instagram") {
                  iconColor = "text-pink-400 bg-pink-500/10 border-pink-500/20";
                } else if (chan.type === "youtube") {
                  iconColor = "text-red-400 bg-red-500/10 border-red-500/20";
                } else if (chan.type === "group") {
                  iconColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                } else if (chan.type === "private") {
                  iconColor = "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
                }

                return (
                  <div key={chan.id} className="bg-slate-950/60 border border-slate-850/60 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 border rounded-xl ${iconColor}`}>
                        {chan.type === "channel" && <Megaphone size={16} />}
                        {chan.type === "group" && <Users size={16} />}
                        {chan.type === "private" && <Lock size={16} />}
                        {chan.type === "instagram" && <Instagram size={16} />}
                        {chan.type === "youtube" && <Youtube size={16} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{chan.name}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                          <span className="px-1.5 py-0.5 bg-slate-900 text-slate-300 rounded uppercase">{chan.type}</span>
                          {chan.telegram_id && <span>Telegram ID: {chan.telegram_id}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <a
                        href={chan.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded-lg"
                      >
                        Havolaga o'tish
                      </a>
                      <button
                        onClick={() => handleDelete(chan.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 rounded-lg transition"
                        title="O'chirish"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
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
