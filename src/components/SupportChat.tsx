import React, { useState, useEffect, useRef } from "react";
import { SupportTicket } from "../types";
import { MessageSquare, Check, Trash2, X, Send, User, ChevronRight, Clock } from "lucide-react";

interface SupportChatProps {
  adminId: string;
  adminName: string;
}

export default function SupportChat({ adminId, adminName }: SupportChatProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 8000); // Poll support tickets every 8s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Auto Scroll to bottom of chat when selecting or getting messages
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedTicketId, tickets]);

  const fetchTickets = async () => {
    try {
      const res = await fetch("/api/support");
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      console.error("Failed to load tickets:", err);
    }
  };

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyText.trim()) return;

    const payload = {
      ticketId: selectedTicketId,
      text: replyText.trim(),
      adminId,
      adminName
    };

    try {
      const res = await fetch("/api/support/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setReplyText("");
        fetchTickets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    try {
      const res = await fetch("/api/support/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, adminId })
      });
      if (res.ok) {
        fetchTickets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white uppercase tracking-tight">💬 MIJOZLAR BILAN ALOQA (SUPPORT)</h1>
        <p className="text-xs text-slate-400 mt-1">
          Foydalanuvchilardan kelgan murojaat va savollarga to'g'ridan-to'g'ri telegramga javob qaytarish tizimi
        </p>
      </div>

      {/* Main chat window layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-[550px] items-stretch">
        {/* TICKETS SIDEBAR */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl md:col-span-4 p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Murojaatlar ro'yxati</p>
            
            {tickets.length === 0 ? (
              <p className="text-center text-xs py-10 text-slate-500 italic">Hozircha hech qanday support murojaati kelmagan.</p>
            ) : (
              <div className="space-y-2">
                {tickets.map((t) => {
                  const lastMsg = t.messages[t.messages.length - 1];
                  const time = new Date(t.last_updated).toLocaleTimeString("UZ-uz", { hour: "numeric", minute: "numeric" });
                  const isSelected = t.id === selectedTicketId;

                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`w-full text-left p-3 rounded-lg border transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                        isSelected 
                          ? "bg-cyan-600/10 border-cyan-500/50" 
                          : "bg-slate-950/40 border-slate-850/60 hover:bg-slate-950/70"
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-bold text-white max-w-[130px] truncate">
                          {t.first_name || `@${t.username}` || `Mijoz ${t.user_id}`}
                        </span>
                        
                        {/* Status tag */}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase ${
                          t.status === "Kutilmoqda" 
                            ? "bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse" 
                            : t.status === "Ochiq" 
                              ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
                              : "bg-slate-800 text-slate-500"
                        }`}>
                          {t.status}
                        </span>
                      </div>

                      {lastMsg && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                          {lastMsg.sender === "admin" ? "Siz: " : ""}{lastMsg.text}
                        </p>
                      )}

                      <span className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1">
                        <Clock size={10} />
                        So'nggi faollik: {time}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ACTIVE CONVERSATION SHEET */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl md:col-span-8 flex flex-col justify-between overflow-hidden relative">
          {selectedTicket ? (
            <>
              {/* Converation Box Header */}
              <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {selectedTicket.first_name || `@${selectedTicket.username}`} ({selectedTicket.user_id})
                  </h3>
                  <a
                    href={`https://t.me/${selectedTicket.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-cyan-400 font-semibold hover:underline mt-0.5 block"
                  >
                    @{selectedTicket.username || "username_yoq"}
                  </a>
                </div>

                {selectedTicket.status !== "Yopilgan" && (
                  <button
                    onClick={() => handleCloseTicket(selectedTicket.id)}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-xl font-semibold cursor-pointer"
                  >
                    Mavzuni yopish (Close)
                  </button>
                )}
              </div>

              {/* Chat messages stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {selectedTicket.messages.map((msg, idx) => {
                  const isAdmin = msg.sender === "admin";
                  const dateStr = new Date(msg.timestamp).toLocaleTimeString("UZ-uz", { hour: "numeric", minute: "numeric" });

                  return (
                    <div
                      key={idx}
                      className={`flex flex-col max-w-[80%] ${isAdmin ? "ml-auto items-end" : "mr-auto items-start"}`}
                    >
                      <div className={`p-3 rounded-xl text-xs leading-relaxed ${
                        isAdmin 
                          ? "bg-cyan-600 text-white rounded-tr-none" 
                          : "bg-slate-950/80 text-slate-200 border border-slate-850 rounded-tl-none"
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono mt-1 pr-1 pl-1">
                        {isAdmin ? `Admin • ${dateStr}` : `Mijoz • ${dateStr}`}
                      </span>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Reply message input footer */}
              {selectedTicket.status !== "Yopilgan" ? (
                <form onSubmit={handleSendReply} className="p-3 border-t border-slate-800 bg-slate-950/40 flex gap-2.5 items-center">
                  <input
                    type="text"
                    required
                    maxLength={1000}
                    placeholder="Savol yoki muammoga javob qaytaring..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="submit"
                    className="bg-cyan-600 hover:bg-cyan-500 text-white p-2.5 rounded-xl cursor-pointer"
                  >
                    <Send size={15} />
                  </button>
                </form>
              ) : (
                <div className="p-4 border-t border-slate-800 bg-slate-950/20 text-center text-xs text-slate-500 font-sans italic">
                  Ushbu support mavzusi yopilgan. Foydalanuvchi botga yangi xabar yozsa u kutilmoqda sifatida yana ochiladi.
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3">
              <MessageSquare size={32} className="text-slate-800" />
              <p className="text-xs font-sans">Muloqotni boshlash uchun chap tomondan biron bir murojaat ustiga bosing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
