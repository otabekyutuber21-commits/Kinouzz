import React, { useState, useEffect } from "react";
import { Megaphone, Send, HelpCircle, Save, Check, Globe, ShieldAlert, Sparkles, CheckCircle2 } from "lucide-react";

interface AdBroadcastProps {
  adminId: string;
}

export default function AdBroadcast({ adminId }: AdBroadcastProps) {
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Broadcast results
  const [results, setResults] = useState<{ sent: number; failed: number; blocked: number } | null>(null);

  // Load results metadata
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setResults(null);

    const payload = {
      text: text.trim(),
      image_url: imageUrl.trim() || undefined,
      adminId
    };

    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Reklama yuborishda xatolik yuz berdi");
      }

      setSuccessMsg(data.message || "E'lon yuborish boshlandi! To'liq yakuniy natijani bot loglaridan yoki tizimdan kuzatishingiz mumkin.");
      setText("");
      setImageUrl("");
    } catch (err: any) {
      setError(err.message || "Nomlum xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white uppercase tracking-tight">📢 REKLAMA VA BROADCAST SOHASI</h1>
        <p className="text-xs text-slate-400 mt-1">
          Botning barcha faol a'zolariga rasm va tugmali xabarlarni tezkorda yetkazish markazi
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CONFIGURE AD FORM */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <Send size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Mailing-reklama tayyorlash</span>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl space-y-2">
              <p className="font-bold">{successMsg}</p>
              <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                * Katta a'zolar jamoasi (50k+) bo'lsa, xabarlar yuborilishi orqa xizmat jabhada 2-3 daqiqa vaqt olishi mumkin. Loglar bo'limida natijalarni kuzating.
              </p>
            </div>
          )}

          <form onSubmit={handleSendBroadcast} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Xabar matni (Markdown ruxsat etiladi)</label>
              <textarea
                required
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Salom do'stlar! Kino botimiz yangilandi. Sevimli kinongizni botdan qidiring...&#10;&#10;Qalin yozish: *qalin matn*&#10;Kursiv: _kursiv matn_&#10;Havolalar: [Kanalimiz](https://t.me/...)"
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-700 font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Ilova rasm havolasi (Banner Url - Optional)</label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-1542204172-e7052809a1a4?w=800"
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Rasm yuklansa, xabar rasm ostidagi izoh caption formatida yuboriladi.</span>
            </div>

            {/* SEND BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 cursor-pointer"
            >
              {loading ? "E'lonlar tarqatilmoqda..." : "Reklamani barchaga yuborish"}
            </button>
          </form>
        </div>

        {/* TIPS AND PREVIEW */}
        <div className="lg:col-span-5 space-y-4">
          {/* Markdown Tips */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={14} className="text-cyan-400" />
              Markdown va Qo'shish Formati
            </p>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Telegram e'lonlarida formatting juda ham muhim. Odamlar e'tiborini jalb etish uchun elementlarni diqqat bilan joylashtiring:
            </p>
            <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-850/50 text-[10.5px] font-mono text-slate-400 space-y-1.5">
              <div>• <b className="text-white">*Forsaj 10 kinosi*</b>  ⟶ Bolb (Qalin)</div>
              <div>• <b className="text-white">_Premyera bo'ldi_</b> ⟶ Italic (Kursiv)</div>
              <div>• <b className="text-white">`1001`</b> ⟶ Monospace (Nusxalash oson kod)</div>
              <div>• <b className="text-white">[Kanal Havolasi](link)</b> ⟶ Enbedding silka</div>
            </div>
          </div>

          {/* Schedulling info */}
          <div className="bg-slate-900/30 border border-slate-800/60 rounded-xl p-5 space-y-3 font-sans">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">⏰ Rejalashtirilgan Reklama (Scheduling)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bizning serverlarimiz 24/7 ishlaydi. Siz ma'lum bir sana va soatni rejalashtirish orqali avtomatik tarzda jo'natish tizimini sozlashingiz mumkin.
            </p>
            <span className="text-[10px] text-slate-500 block italic border-t border-slate-850/50 pt-2">
              * Sozlamalar menyusi orqali reklama rejalashtirish bo'yicha maslahatlar oling yoki adminga qo'llab quvvatlash darchasidan yozing.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
