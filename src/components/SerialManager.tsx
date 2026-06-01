import React, { useState, useEffect } from "react";
import { Serial, Season, Episode } from "../types";
import { Plus, Edit2, Trash2, Search, Tv, X, Save, Film, PlayCircle, PlusCircle } from "lucide-react";

interface SerialManagerProps {
  adminId: string;
}

export default function SerialManager({ adminId }: SerialManagerProps) {
  const [serials, setSerials] = useState<Serial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");

  // Form States
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("Drama");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rating, setRating] = useState<number>(8.0);
  const [posterUrl, setPosterUrl] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [codesCsv, setCodesCsv] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);

  // Deletion confirmations
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Load serials on render
  useEffect(() => {
    fetchSerials();
  }, []);

  const fetchSerials = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/serials");
      const data = await res.json();
      setSerials(data);
    } catch (err) {
      console.error("Failed to fetch serials", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setTitle("");
    setDescription("");
    setGenre("Drama");
    setYear(new Date().getFullYear());
    setRating(8.0);
    setPosterUrl("");
    setTrailerUrl("");
    setCodesCsv("");
    setSeasons([]);
    setShowForm(false);
    setError(null);
  };

  const handleEditClick = (s: Serial) => {
    setEditId(s.id);
    setTitle(s.title);
    setDescription(s.description);
    setGenre(s.genre);
    setYear(s.year);
    setRating(s.rating);
    setPosterUrl(s.poster_url || "");
    setTrailerUrl(s.trailer_url || "");
    setCodesCsv(s.codes.join(", "));
    setSeasons(s.seasons || []);
    setShowForm(true);
  };

  // SEASON AND EPISODES BUILDER CONTROLS
  const handleAddSeason = () => {
    const nextSeasonNum = seasons.length > 0 ? Math.max(...seasons.map(s => s.season_num)) + 1 : 1;
    setSeasons([...seasons, { season_num: nextSeasonNum, episodes: [] }]);
  };

  const handleRemoveSeason = (seasonIndex: number) => {
    const backup = [...seasons];
    backup.splice(seasonIndex, 1);
    setSeasons(backup);
  };

  const handleAddEpisode = (seasonIndex: number) => {
    const backup = [...seasons];
    const episodes = backup[seasonIndex].episodes;
    const nextEpNum = episodes.length > 0 ? Math.max(...episodes.map(e => e.episode_num)) + 1 : 1;
    episodes.push({
      episode_num: nextEpNum,
      title: "",
      file_id: ""
    });
    setSeasons(backup);
  };

  const handleRemoveEpisode = (seasonIndex: number, epIndex: number) => {
    const backup = [...seasons];
    backup[seasonIndex].episodes.splice(epIndex, 1);
    setSeasons(backup);
  };

  const handleEpisodeChange = (seasonIndex: number, epIndex: number, field: keyof Episode, value: any) => {
    const backup = [...seasons];
    const ep = backup[seasonIndex].episodes[epIndex];
    if (field === "episode_num") {
      ep.episode_num = Number(value);
    } else {
      (ep as any)[field] = value;
    }
    setSeasons(backup);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setError(null);
    const codes = codesCsv.split(",")
      .map(c => c.trim())
      .filter(c => c !== "");

    const payload = {
      title: title.trim(),
      description: description.trim(),
      genre,
      year,
      rating,
      poster_url: posterUrl.trim(),
      trailer_url: trailerUrl.trim(),
      codes,
      seasons,
      adminId
    };

    try {
      const url = editId ? `/api/serials/${editId}` : "/api/serials";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Operatsiyada xatolik");
      }

      resetForm();
      fetchSerials();
    } catch (err: any) {
      setError(err.message || "Xatolik yuz berdi");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/serials/${id}?adminId=${adminId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setDeleteId(null);
        fetchSerials();
      }
    } catch (err) {
      console.error("Serial deletion error:", err);
    }
  };

  const filteredSerials = serials.filter((s) => {
    const matchesQuery = s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         s.codes.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesGenre = genreFilter === "all" || s.genre === genreFilter;
    return matchesQuery && matchesGenre;
  });

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-white uppercase tracking-tight font-sans">📺 SERIAL BOSHQARUVI</h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">Ko'p faslli turkum va seriallarni mukammal tarzda guruhlang</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-stretch sm:self-auto justify-center"
        >
          <Plus size={15} />
          Yangi serial qo'shish
        </button>
      </div>

      {/* FILTER BUTTONS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-2 md:col-span-3">
          <Search size={18} className="text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Nomi yoki kodi orqali qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none w-full"
          />
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="bg-transparent text-sm text-slate-300 w-full focus:outline-none border-none"
          >
            <option value="all" className="bg-slate-950 text-white">Barcha Janrlar</option>
            <option value="Drama" className="bg-slate-950 text-white">Drama</option>
            <option value="Jangari" className="bg-slate-950 text-white">Jangari</option>
            <option value="Komediya" className="bg-slate-950 text-white">Komediya</option>
            <option value="Fantastika" className="bg-slate-950 text-white">Fantastika</option>
            <option value="Tarixiy" className="bg-slate-950 text-white">Tarixiy</option>
            <option value="Triller" className="bg-slate-950 text-white">Triller</option>
          </select>
        </div>
      </div>

      {/* LIST OF SERIALS */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">Yuklanmoqda...</div>
      ) : filteredSerials.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/20 rounded-2xl border border-slate-800/50 text-slate-500 text-xs">
          Hech qanday serial topilmadi.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSerials.map((s) => (
            <div key={s.id} className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/60 transition-all group duration-150">
              <div className="space-y-3">
                <div className="flex gap-3.5 items-start">
                  <div className="w-14 h-20 rounded bg-slate-950/70 border border-slate-850 shrink-0 overflow-hidden relative flex items-center justify-center text-slate-600">
                    {s.poster_url && s.poster_url.trim().startsWith("http") ? (
                      <img src={s.poster_url} alt={s.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Tv size={20} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{s.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{s.year} • {s.genre}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      {s.codes.map((c) => (
                        <span key={c} className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono text-[9px] font-bold rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed italic">{s.description || "Tavsif kiritilmagan."}</p>

                <div className="bg-slate-950/50 rounded-lg p-2.5 space-y-1 text-[10px] text-slate-500 border border-slate-900/60 font-mono">
                  <div className="flex justify-between">
                    <span>Ovozlar:</span>
                    <span className="text-slate-300">👍 {s.likes || 0} | 👎 {s.dislikes || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fasllar / Jami Qismlar:</span>
                    <span className="text-cyan-400 font-bold">{s.seasons?.length || 0} ta fasl / {s.seasons?.reduce((total, cur) => total + (cur.episodes?.length || 0), 0) || 0} qism</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ko'rishlar:</span>
                    <span className="text-slate-300">👁 {s.views || 0} marta</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-850/50">
                <button
                  onClick={() => handleEditClick(s)}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Edit2 size={12} />
                  Tahrirlash / Qism qo'shish
                </button>
                <button
                  onClick={() => setDeleteId(s.id)}
                  className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETAILED FORM DIALOG MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6">
            <button onClick={resetForm} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X size={20} />
            </button>

            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-tight font-sans">
                {editId ? "📺 Serial Ma'lumotlarini Tahrirlash" : "📺 Yangi Serial Qo'shish"}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Serial profili, fasllari va individual qismlarini boshqaring
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Serial Nomi</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Masalan: Ertugrul (Turkiya seriali)"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Janri</label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="Drama">Drama</option>
                    <option value="Jangari">Jangari</option>
                    <option value="Komediya">Komediya</option>
                    <option value="Fantastika">Fantastika</option>
                    <option value="Tarixiy">Tarixiy</option>
                    <option value="Triller">Triller</option>
                  </select>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Yili</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Reyting (0 - 10)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tavsif (Tafsilotlar)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Serial syujeti..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Codes */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Serial Kodlari</label>
                <input
                  type="text"
                  value={codesCsv}
                  onChange={(e) => setCodesCsv(e.target.value)}
                  placeholder="Masalan: ERTUGRUL, ERT1. Bo'sh qolsa avtomatik generatsiya bo'ladi."
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                />
              </div>

              {/* Media links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Poster URL (Rasm)</label>
                  <input
                    type="text"
                    value={posterUrl}
                    onChange={(e) => setPosterUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/promo..."
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Trailer URL (YouTube / link)</label>
                  <input
                    type="text"
                    value={trailerUrl}
                    onChange={(e) => setTrailerUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              {/* SPECIAL SEASON AND EPISODE EMBEDDED CONTROLLER */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-850 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Tv size={14} className="text-cyan-400" />
                    Serial Fasllari va Individual Qismlari
                  </p>
                  <button
                    type="button"
                    onClick={handleAddSeason}
                    className="bg-cyan-500/10 hover:bg-cyan-505 border border-cyan-500/20 text-cyan-400 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={12} />
                    Fasl qo'shish
                  </button>
                </div>

                {seasons.length === 0 ? (
                  <p className="text-center text-xs py-8 text-slate-500 italic">Xali hech qanday fasl qo'shilmagan. Yuqoridagi tugmani bosib yangi fasl va qismlaringizni kiriting.</p>
                ) : (
                  <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                    {seasons.map((season, sIndex) => (
                      <div key={sIndex} className="p-3 bg-slate-950/70 border border-slate-850 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-300 font-sans">Fasl {season.season_num}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({season.episodes?.length || 0} qism)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAddEpisode(sIndex)}
                              className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded cursor-pointer font-bold"
                            >
                              + Epizod qo'shish
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSeason(sIndex)}
                              className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded cursor-pointer font-bold"
                            >
                              O'chirish
                            </button>
                          </div>
                        </div>

                        {/* Episodes inside Season */}
                        {season.episodes?.length > 0 && (
                          <div className="space-y-2 border-t border-slate-850/50 pt-2">
                            {season.episodes.map((ep, epIndex) => (
                              <div key={epIndex} className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-2">
                                  <input
                                    type="number"
                                    required
                                    value={ep.episode_num}
                                    onChange={(e) => handleEpisodeChange(sIndex, epIndex, "episode_num", e.target.value)}
                                    placeholder="No"
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-center text-white"
                                  />
                                </div>
                                <div className="col-span-5">
                                  <input
                                    type="text"
                                    value={ep.title}
                                    onChange={(e) => handleEpisodeChange(sIndex, epIndex, "title", e.target.value)}
                                    placeholder="Nomi (masalan: Soniya)"
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                                  />
                                </div>
                                <div className="col-span-4">
                                  <input
                                    type="text"
                                    required
                                    value={ep.file_id}
                                    onChange={(e) => handleEpisodeChange(sIndex, epIndex, "file_id", e.target.value)}
                                    placeholder="File ID / Telegram link"
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                                  />
                                </div>
                                <div className="col-span-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEpisode(sIndex, epIndex)}
                                    className="text-red-400 hover:text-red-300 cursor-pointer text-sm"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit footer */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2 px-4 rounded-xl text-xs cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Save size={13} />
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE DIALOG */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-tight font-sans">Serialni o'chirishni tasdiqlang</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Rostdan ham ushbu serialni va uning barcha fasllarini, qismlarini o'chirmoqchimisiz? Ushbu amal ortga qaytarilmaydi!
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setDeleteId(null)}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 py-2 px-4 rounded-xl text-xs font-medium cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="bg-red-600 hover:bg-red-500 text-white py-2 px-4 rounded-xl text-xs font-medium cursor-pointer"
              >
                O'chirilsin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
