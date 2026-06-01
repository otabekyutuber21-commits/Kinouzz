import React, { useState, useEffect } from "react";
import { LogEntry } from "../types";
import { ClipboardList, Shield, RefreshCw, Terminal, Clock, Activity } from "lucide-react";

export default function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/logs");
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white uppercase tracking-tight">📜 TIZIM HARAKATLARI LOGI</h1>
          <p className="text-xs text-slate-400 mt-1">Bot va ma'muriyat tomonidan amalga oshirilgan operatsiyalarning voqealar xronologiyasi</p>
        </div>

        <button
          onClick={fetchLogs}
          className="bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Yangilash
        </button>
      </div>

      {/* LOG STREAM LINER */}
      {loading ? (
        <p className="text-xs text-slate-400 text-center py-10">Loglar yangilanmoqda...</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-12 italic">Hozircha hech qanday log qayd etilmagan.</p>
      ) : (
        <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 font-mono text-[11px] space-y-2.5 max-h-[500px] overflow-y-auto shadow-inner relative">
          <div className="absolute top-3 right-4 flex items-center gap-1.5 text-slate-600">
            <Terminal size={11} />
            <span>sys_terminal: ~logs</span>
          </div>

          <div className="divide-y divide-slate-900">
            {logs.map((log) => {
              const date = new Date(log.timestamp).toLocaleDateString("UZ-uz");
              const time = new Date(log.timestamp).toLocaleTimeString("UZ-uz", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

              // Dynamic label coloring
              let labelColor = "text-slate-500";
              const action = log.action.toLowerCase();
              if (action.includes("qo'shildi")) labelColor = "text-emerald-400 font-bold";
              else if (action.includes("o'chirildi")) labelColor = "text-red-400 font-bold";
              else if (action.includes("bloklandi")) labelColor = "text-rose-500 font-bold font-semibold animate-pulse";
              else if (action.includes("javoblandi")) labelColor = "text-cyan-400 font-bold";
              else if (action.includes("kirish")) labelColor = "text-blue-400 font-semibold";
              else if (action.includes("sozlamalar")) labelColor = "text-purple-400 font-semibold";

              return (
                <div key={log.id} className="py-2.5 flex items-start gap-4 hover:bg-slate-900/40 transition px-2 rounded">
                  <span className="text-slate-600 font-bold whitespace-nowrap shrink-0">
                    [{date} {time}]
                  </span>
                  <div className="min-w-0">
                    <span className={`${labelColor} mr-2 uppercase text-[10px]`}>
                      /{log.action}
                    </span>
                    <span className="text-slate-300 leading-relaxed break-all">
                      {log.details}
                    </span>
                    {log.admin_id && (
                      <span className="text-slate-500 font-bold block mt-1">
                        ✍️ Ma'mur: ID {log.admin_id} {log.admin_name ? `(${log.admin_name})` : ""}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
