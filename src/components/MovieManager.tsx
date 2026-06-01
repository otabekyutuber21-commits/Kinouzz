import React, { useState, useEffect } from "react";
import { Movie, VideoQualities } from "../types";
import { Plus, Edit2, Trash2, Search, Film, X, HelpCircle, Save, Check } from "lucide-react";

interface MovieManagerProps {
  adminId: string;
}

export default function MovieManager({ adminId }: MovieManagerProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search and sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("Jangari");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rating, setRating] = useState<number>(7.5);
  const [posterUrl, setPosterUrl] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [codesCsv, setCodesCsv] = useState(""); // Comma-separated
  
  // Quality URLs
  const [qualHD, setQualHD] = useState("");
  const [qualFHD, setQualFHD] = useState("");
  const [qual4K, setQual4K] = useState("");

  // Confirmation box modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/movies");
      const data = await res.json();
      setMovies(data);
    } catch (err) {
      console.error("Failed to load movies:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setTitle("");
    setDescription("");
    setGenre("Jangari");
    setYear(new Date().getFullYear());
    setRating(7.5);
    setPosterUrl("");
    setTrailerUrl("");
    setCodesCsv("");
    setQualHD("");
    setQualFHD("");
    setQual4K("");
    setShowForm(false);
    setError(null);
  };

  const handleEditClick = (m: Movie) => {
    setEditId(m.id);
    setTitle(m.title);
    setDescription(m.description);
    setGenre(m.genre);
    setYear(m.year);
    setRating(m.rating);
    setPosterUrl(m.poster_url || "");
    setTrailerUrl(m.trailer_url || "");
    setCodesCsv(m.codes.join(", "));
    
    setQualHD(m.video_quality_urls?.HD || "");
    setQualFHD(m.video_quality_urls?.["Full HD"] || "");
    setQual4K(m.video_quality_urls?.["4K"] || "");

    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setError(null);
    const codes = codesCsv.split(",")
      .map(c => c.trim())
      .filter(c => c !== "");

    const video_quality_urls: VideoQualities = {};
    if (qualHD.trim()) video_quality_urls.HD = qualHD.trim();
    if (qualFHD.trim()) video_quality_urls["Full HD"] = qualFHD.trim();
    if (qual4K.trim()) video_quality_urls["4K"] = qual4K.trim();

    const payload = {
      title: title.trim(),
      description: description.trim(),
      genre,
      year,
      rating,
      poster_url: posterUrl.trim(),
      trailer_url: trailerUrl.trim(),
      codes,
      video_quality_urls,
      adminId
    };

    try {
      const url = editId ? `/api/movies/${editId}` : "/api/movies";
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
      fetchMovies();
    } catch (err: any) {
      setError(err.message || "Xatolik yuz berdi");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/movies/${id}?adminId=${adminId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchMovies();
      }
    } catch (err) {
      console.error("Movie deletion error:", err);
    }
  };

  // Filter movies
  const filteredMovies = movies.filter((m) => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.codes.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesGenre = genreFilter === "all" || m.genre === genreFilter;
    return matchesSearch && matchesGenre;
  });

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-white uppercase tracking-tight">🎬 KINO BOSHQARUVI</h1>
          <p className="text-xs text-slate-400 mt-1">Botdagi kinolarni tahrirlash, qo'shish va royxatni yangib turish paneli</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-stretch sm:self-auto justify-center"
        >
          <Plus size={15} />
          Yangi kino qo'shish
        </button>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-2 md:col-span-3">
          <Search size={18} className="text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Nomi yoki kodi orqali tezkor qidiruv..."
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
            <option value="Jangari" className="bg-slate-950 text-white">Jangari</option>
            <option value="Komediya" className="bg-slate-950 text-white">Komediya</option>
            <option value="Drama" className="bg-slate-950 text-white">Drama</option>
            <option value="Fantastika" className="bg-slate-950 text-white">Fantastika</option>
            <option value="Qo'rqinchli" className="bg-slate-950 text-white">Qo'rqinchli</option>
            <option value="Triller" className="bg-slate-950 text-white">Triller</option>
            <option value="Tarixiy" className="bg-slate-950 text-white">Tarixiy</option>
            <option value="Romantik" className="bg-slate-950 text-white">Romantik</option>
          </select>
        </div>
      </div>

      {/* LIST OF MOVIES */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Ma'lumotlar yuklanmoqda...</div>
      ) : filteredMovies.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/20 rounded-2xl border border-slate-800/50 text-slate-500 text-sm">
          Hech qanday kino topilmadi.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMovies.map((m) => (
            <div key={m.id} className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/60 transition-all group duration-150">
              <div className="space-y-3">
                <div className="flex gap-3.5 items-start">
                  <div className="w-14 h-20 rounded bg-slate-950/70 border border-slate-850 shrink-0 overflow-hidden relative flex items-center justify-center text-slate-600">
                    {m.poster_url && m.poster_url.trim().startsWith("http") ? (
                      <img src={m.poster_url} alt={m.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Film size={20} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{m.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{m.year} • {m.genre}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {m.codes.map((c) => (
                        <span key={c} className="px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-[10px] font-bold rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed italic">{m.description || "Tavsif kiritilmagan."}</p>
                
                <div className="bg-slate-950/50 rounded-lg p-2.5 space-y-1 text-[10px] text-slate-500 border border-slate-900/60 font-mono">
                  <div className="flex justify-between">
                    <span>Ovozlar:</span>
                    <span className="text-slate-300">👍 {m.likes} | 👎 {m.dislikes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ko'rishlar / Yuklashlar:</span>
                    <span className="text-slate-300">👁 {m.views} marta / 📥 {m.downloads} ta</span>
                  </div>
                  {m.video_quality_urls && (
                    <div className="flex justify-between">
                      <span>Sifatlar:</span>
                      <span className="text-cyan-400 font-bold">{Object.keys(m.video_quality_urls).join(", ") || "FHD"}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-850/50">
                <button
                  onClick={() => handleEditClick(m)}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Edit2 size={12} />
                  Tahrirlash
                </button>
                <button
                  onClick={() => setDeleteConfirmId(m.id)}
                  className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DIALOG FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6">
            <button onClick={resetForm} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X size={20} />
            </button>

            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                {editId ? "🎬 Kino Ma'lumotlarini Tahrirlash" : "🎬 Yangi Kino Qo'shish"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Kino tafsilotlarini va video sifat havolalarini kiriting.
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Kino Nomi</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Masalan: Forsaj 10 (Uzbek tilida)"
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
                    <option value="Jangari">Jangari</option>
                    <option value="Komediya">Komediya</option>
                    <option value="Drama">Drama</option>
                    <option value="Fantastika">Fantastika</option>
                    <option value="Qo'rqinchli">Qo'rqinchli</option>
                    <option value="Triller">Triller</option>
                    <option value="Tarixiy">Tarixiy</option>
                    <option value="Romantik">Romantik</option>
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Reytingi (0 - 10)</label>
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

              {/* Row 3 */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tavsif (Tafsilotlar)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kino haqida qisqacha ma'lumot..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Codes inputs */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Kino Kodlari (Xohlagancha: 1001, FORSAJ10, AVATAR keys)
                </label>
                <input
                  type="text"
                  value={codesCsv}
                  onChange={(e) => setCodesCsv(e.target.value)}
                  placeholder="Korsatilmagan holda, avtomatik ravishda ketma-ket yaratiladi: 1001, 1002, ..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                />
                <span className="text-[10px] text-slate-500 block mt-1">Vergul bilan ajratib bir necha kod yozing. Bo'sh qolsa sequential kod yaratadi!</span>
              </div>

              {/* Poster and trailer links */}
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Trailer URL (YouTube / Telegram post)</label>
                  <input
                    type="text"
                    value={trailerUrl}
                    onChange={(e) => setTrailerUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              {/* VIDEO QUALITIES ROW (STORAGE BASE OR POST ID VALUE) */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-850 space-y-3">
                <p className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Film size={14} className="text-cyan-400" />
                  Video Sifatlari / Storage Post ID havolalari
                </p>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Kanaldagi fayl yuklamasini kamaytirish uchun HD, Full HD yoki 4K post havolalari yoki file ID larini quyidagi maydonlarga biriktiring.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">HD (Kanal Havolasi)</label>
                    <input
                      type="text"
                      value={qualHD}
                      onChange={(e) => setQualHD(e.target.value)}
                      placeholder="e.g. https://t.me/c/..."
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Full HD (Kanal Havolasi)</label>
                    <input
                      type="text"
                      value={qualFHD}
                      onChange={(e) => setQualFHD(e.target.value)}
                      placeholder="e.g. https://t.me/c/..."
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">4K (Kanal Havolasi)</label>
                    <input
                      type="text"
                      value={qual4K}
                      onChange={(e) => setQual4K(e.target.value)}
                      placeholder="e.g. https://t.me/c/..."
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
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

      {/* DETAILED DELETE CONFIRM DIALOG */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">Kino o'chirishni tasdiqlang</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Siz rostdan ham ushbu kinoni butunlay o'chirmoqchimisiz? Ushbu amal qaytarib bo'lmas va statistikalar yo'qoladi.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 py-2 px-4 rounded-xl text-xs font-medium cursor-pointer"
              >
                Yo'q, qolsin
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="bg-red-600 hover:bg-red-500 text-white py-2 px-4 rounded-xl text-xs font-medium cursor-pointer"
              >
                Rostdan o'chirilsin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
