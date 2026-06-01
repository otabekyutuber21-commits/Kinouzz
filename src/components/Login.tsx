import React, { useState } from "react";
import { KeyRound, ShieldAlert, CheckCircle2, Ticket, HelpCircle } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (adminId: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [adminId, setAdminId] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId.trim()) return;

    setLoading(true);
    setError(null);
    setInfoMsg(null);
    setDevCode(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: adminId }),
      });
      const data = await res.json();
      
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Tizimga kirishda xatolik yuz berdi");
      }

      setStep(2);
      setInfoMsg(data.message || "Tasdiqlash kodi Telegram botingizga yuborildi!");
      if (data.dev_code) {
        setDevCode(data.dev_code);
      }
    } catch (err: any) {
      setError(err.message || "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: adminId, code }),
      });
      const data = await res.json();

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Tasdiqlash kodi noto'g'ri");
      }

      localStorage.setItem("admin_id", adminId);
      localStorage.setItem("admin_token", data.token);
      onLoginSuccess(adminId);
    } catch (err: any) {
      setError(err.message || "Kodni tasdiqlashda xato kiritildi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/15 via-transparent to-transparent pointer-events-none" />
      
      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-80" />
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 mb-4 text-cyan-400">
            <KeyRound size={28} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white font-sans">
            KINO BOT BOSHQARUV TIZIMI
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Professional Admin Dashboardiga kirish portali
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-sm text-red-400">
            <ShieldAlert size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {infoMsg && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 text-sm text-emerald-400">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-300">Success</p>
              <p className="mt-0.5">{infoMsg}</p>
            </div>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-5">
            <div>
              <label htmlFor="adminId" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Telegram Admin ID
              </label>
              <input
                id="adminId"
                type="text"
                placeholder="Masalan: 8939863862"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none transition-all duration-150 font-mono"
              />
              <span className="text-[11px] text-slate-500 block mt-2 leading-relaxed">
                * Asosiy Super Admin ID: <code className="text-slate-400">8939863862</code>. Tizimga ulangan botga start bergan bo'lishingiz lozim!
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-3 px-4 rounded-xl transition-all duration-150 shadow-lg shadow-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? "Kutilmoqda..." : "Tasdiqlash kodini olish"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div>
              <label htmlFor="code" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                6 xonali tasdiqlash kodi
              </label>
              <input
                id="code"
                type="text"
                maxLength={6}
                placeholder="Masalan: 582914"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-center text-xl text-white font-mono tracking-widest focus:outline-none transition-all duration-150"
              />
              
              {devCode && (
                <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-2 text-xs font-mono text-cyan-300 justify-between">
                  <span>Sinov/Dev ID uchun kod:</span>
                  <span className="bg-cyan-500/10 text-cyan-400 font-bold px-2 py-0.5 rounded text-sm">{devCode}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium py-3 px-4 rounded-xl transition-all duration-150 border border-slate-700/50 cursor-pointer text-center text-sm"
              >
                Orqaga
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-3 px-4 rounded-xl transition-all duration-150 shadow-lg shadow-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
              >
                {loading ? "Tasdiqlanmoqda..." : "Dashboardga kirish"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 border-t border-slate-800/80 pt-6 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Ticket size={13} />
            <span>Kino Bot Panel v2.1</span>
          </div>
          <div className="flex items-center gap-1">
            <HelpCircle size={13} />
            <a href="https://t.me/brazzersmy08" target="_blank" rel="noreferrer" className="hover:text-slate-300">Qo'llab-quvvatlash</a>
          </div>
        </div>
      </div>
    </div>
  );
}
