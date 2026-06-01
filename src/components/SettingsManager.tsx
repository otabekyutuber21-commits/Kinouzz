import React, { useState, useEffect } from "react";
import { BotSettings } from "../types";
import { Save, Bot, Info, ShieldAlert, CheckCircle, Smartphone, Lock, EyeOff, ClipboardPaste } from "lucide-react";

interface SettingsManagerProps {
  adminId: string;
}

export default function SettingsManager({ adminId }: SettingsManagerProps) {
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Individual form states
  const [botName, setBotName] = useState("");
  const [botPhoto, setBotPhoto] = useState("");
  const [startMsg, setStartMsg] = useState("");
  const [supportMsg, setSupportMsg] = useState("");
  const [adMsg, setAdMsg] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [appUrl, setAppUrl] = useState("");

  // Backup file state
  const [backupJson, setBackupJson] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data);
      
      setBotName(data.bot_name || "");
      setBotPhoto(data.bot_photo || "");
      setStartMsg(data.start_msg || "");
      setSupportMsg(data.support_msg || "");
      setAdMsg(data.ad_msg || "");
      setInstagram(data.instagram_link || "");
      setYoutube(data.youtube_link || "");
      setIsActive(data.is_active !== undefined ? data.is_active : true);
      setAppUrl(data.app_url || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const payload = {
      bot_name: botName,
      bot_photo: botPhoto,
      start_msg: startMsg,
      support_msg: supportMsg,
      ad_msg: adMsg,
      instagram_link: instagram,
      youtube_link: youtube,
      is_active: isActive,
      app_url: appUrl,
      adminId
    };

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSuccess(true);
        fetchSettings();
        // Hide success alert after 3s
        setTimeout(() => setSuccess(false), 3000);
      } else {
        throw new Error("Saqlashda xatolik yuz berdi");
      }
    } catch (err: any) {
      setError(err.message || "Xatolik");
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch("/api/backup");
      const data = await res.json();
      const str = JSON.stringify(data, null, 2);
      
      // Trigger native download
      const blob = new Blob([str], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kino_bot_db_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white uppercase tracking-tight">⚙️ BOT SOZLAMALARI VA BACKUP</h1>
        <p className="text-xs text-slate-400 mt-1">
          Botning asosiy boshlanish matnini, vizual holatlarini va zaxira nusxalarini to'liq boshqaring
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-10">Yuklanmoqda...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* CORE STATS SETTING FORM */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-cyan-400">
              <Bot size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Tizim Matnlari Interfeysi</span>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-1.5 font-sans font-bold">
                <CheckCircle size={15} />
                Sozlamalar muvaffaqiyatli saqlandi!
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Row 1: Bot name and Photo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Bot Nomi</label>
                  <input
                    type="text"
                    required
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Bot Launcher Rasm URL (Optional)</label>
                  <input
                    type="text"
                    value={botPhoto}
                    onChange={(e) => setBotPhoto(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                  />
                </div>
              </div>

              {/* Start text */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Start / Gid buyruq matni (/start)</label>
                <textarea
                  rows={3}
                  required
                  value={startMsg}
                  onChange={(e) => setStartMsg(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Support prompt description details */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Support darchasi bo'yicha e'lon matni (Foydalanuvchi menyusida)</label>
                <textarea
                  rows={2}
                  required
                  value={supportMsg}
                  onChange={(e) => setSupportMsg(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Revenue/Ad message and details */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Hamkorlik / Reklama beruvchilar uchun bildirish matni</label>
                <textarea
                  rows={2}
                  value={adMsg}
                  onChange={(e) => setAdMsg(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Instagram & Youtube links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Instagram Havolasi</label>
                  <input
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="https://instagram.com/..."
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">YouTube Havolasi</label>
                  <input
                    type="text"
                    value={youtube}
                    onChange={(e) => setYoutube(e.target.value)}
                    placeholder="https://youtube.com/..."
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                  />
                </div>
              </div>

              {/* Telegram Web App URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">📋 Admin Panel Mini App Havolasi (APP_URL)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={appUrl}
                    onChange={(e) => setAppUrl(e.target.value)}
                    placeholder="https://ais-dev-...asia-southeast1.run.app"
                    className="w-full flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const txt = await navigator.clipboard.readText();
                        if (txt) setAppUrl(txt);
                      } catch (e) {}
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-350 px-3 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition"
                    title="Buferdan joylash"
                  >
                    <ClipboardPaste size={14} /> Joylash
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  Telegramdagi "Admin Panel (Mini App)" tugmasi aynan shu havolaga ulanadi. O'zgarish kuchga kirishi uchun saqlagandan so'ng botni qayta o'qiting.
                </p>
              </div>

              {/* BOT STATUS TOGGLE: ON/OFF ACTION */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-850 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Botning Umubiy holati (ON / OFF)</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                    Botni o'chirsangiz, sizdan tashqari barcha foydalanuvchilar "Bot texnik ishlar sababli vaqtincha faoliyatsiz" xabarini olishadi.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase font-mono ${isActive ? "text-emerald-400" : "text-amber-500"}`}>
                    {isActive ? "FAOL (ON)" : "TEXNIK TA'TIL (OFF)"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`w-11 h-6 rounded-full p-0.5 transition duration-200 focus:outline-none cursor-pointer ${
                      isActive ? "bg-emerald-600" : "bg-slate-700"
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow transition transform duration-200 ${
                      isActive ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              </div>

              {/* Form submit */}
              <div className="pt-4 border-t border-slate-850">
                <button
                  type="submit"
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} />
                  Sozlamalarni saqlash
                </button>
              </div>
            </form>
          </div>

          {/* BACKUP MODULE CARD */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-purple-400">
              <Lock size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Zaxira Nusxalash (Backup)</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              O'tkazilgan operatsiyalar, kino kodlari, ro'yxatdan o'tgan a'zolar hamda so'rovlarni bir tugma bilan diskka yuklab oling.
            </p>

            <button
              onClick={handleDownloadBackup}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold py-2 px-4 rounded-xl transition duration-150 cursor-pointer flex items-center justify-center gap-1.5 shadow"
            >
              <ClipboardPaste size={14} />
              JSON Backup Yuklab Olish (Download)
            </button>

            <div className="border-t border-slate-850/50 pt-4 space-y-3 font-sans">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avtomatik Backup kanali</h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Tizim har kuni kechasi 00:00 da bazaning to'liq nusxasini sizning zayafka/backup telegram kanalingizga yuklab boradi. Xavfsizlik har doim birinchi o'rinda.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
