import fs from "fs";
import path from "path";

export interface User {
  id: string;
  username?: string;
  first_name?: string;
  joined_at: string;
  last_active_at: string;
  referrals_count: number;
  referred_by?: string;
  is_banned: boolean;
  is_premium: boolean;
}

export interface VideoQualities {
  HD?: string;
  "Full HD"?: string;
  "4K"?: string;
}

export interface Movie {
  id: number;
  codes: string[];
  title: string;
  description: string;
  genre: string;
  year: number;
  rating: number;
  video_quality_urls: VideoQualities;
  poster_url?: string;
  trailer_url?: string;
  views: number;
  downloads: number;
  likes: number;
  dislikes: number;
}

export interface Episode {
  episode_num: number;
  title: string;
  file_id: string; // post ID or telegram file ID
}

export interface Season {
  season_num: number;
  episodes: Episode[];
}

export interface Serial {
  id: number;
  codes: string[];
  title: string;
  description: string;
  genre: string;
  year: number;
  rating: number;
  poster_url?: string;
  trailer_url?: string;
  seasons: Season[];
  views: number;
  likes: number;
  dislikes: number;
}

export interface SupportTicket {
  id: string; // custom ticket ID or numeric prefix
  user_id: string;
  username?: string;
  first_name?: string;
  status: "Ochiq" | "Yopilgan" | "Kutilmoqda";
  messages: Array<{
    sender: "user" | "admin";
    text: string;
    timestamp: string;
  }>;
  last_updated: string;
}

export interface MovieRequest {
  id: string;
  user_id: string;
  username?: string;
  movie_title: string;
  status: "Kutilmoqda" | "Bajarildi" | "Rad etildi";
  admin_notes?: string;
  created_at: string;
}

export interface MandatoryChannel {
  id: string;
  name: string;
  url: string;
  telegram_id: string; // e.g. -100xxxxxx
  type: "channel" | "group" | "private" | "instagram" | "youtube";
}

export interface AdCampaign {
  id: string;
  text: string;
  image_url?: string;
  scheduled_at?: string; // Date string
  sent_count: number;
  failed_count: number;
  blocked_count: number;
  status: "Draft" | "Scheduled" | "Completed" | "Failed";
}

export interface LogEntry {
  id: string;
  timestamp: string;
  admin_id?: string;
  admin_name?: string;
  action: string;
  details: string;
}

export interface BotSettings {
  bot_name: string;
  bot_photo?: string;
  start_msg: string;
  support_msg: string;
  ad_msg: string;
  instagram_link?: string;
  youtube_link?: string;
  is_active: boolean; // bot state ON / OFF
  app_url?: string;
}

export interface Vote {
  user_id: string;
  movie_id: number;
  is_serial: boolean;
  type: "like" | "dislike";
}

export interface SearchHistory {
  id: string;
  user_id: string;
  query: string;
  timestamp: string;
}

export interface AdminSession {
  admin_id: string;
  login_time: string;
  login_code?: string;
}

export interface DatabaseStructure {
  users: Record<string, User>;
  movies: Movie[];
  serials: Serial[];
  channels: MandatoryChannel[];
  support: SupportTicket[];
  requests: MovieRequest[];
  logs: LogEntry[];
  settings: BotSettings;
  votes: Vote[];
  history: SearchHistory[];
  sessions: Record<string, AdminSession>;
  admins: string[]; // List of Admin Telegram IDs as strings
}

const DB_FILE_PATH = path.join(process.cwd(), "database.json");

const defaultSettings: BotSettings = {
  bot_name: "Kino Bot",
  bot_photo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800",
  start_msg: "Assalomu alaykum! Xush kelibsiz. Kino kodini kiritib qidirishingiz yoki quyidagi menyulardan foydalanishingiz mumkin.",
  support_msg: "Muammo yoki taklifingiz bo'lsa, xabaringizni shu yerga yozing. Adminlarimiz tez orada javob berishadi.",
  ad_msg: "Kino botimizda reklama berish yoki hamkorlik uchun admin bilan bog'laning.",
  instagram_link: "",
  youtube_link: "",
  is_active: true,
  app_url: "",
};

let dbCache: DatabaseStructure | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

export function loadDb(): DatabaseStructure {
  if (dbCache) {
    return dbCache;
  }

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const content = fs.readFileSync(DB_FILE_PATH, "utf-8");
      dbCache = JSON.parse(content);
      // Ensure structure is up to date
      dbCache!.users = dbCache!.users || {};
      dbCache!.movies = dbCache!.movies || [];
      dbCache!.serials = dbCache!.serials || [];
      dbCache!.channels = dbCache!.channels || [];
      dbCache!.support = dbCache!.support || [];
      dbCache!.requests = dbCache!.requests || [];
      dbCache!.logs = dbCache!.logs || [];
      dbCache!.votes = dbCache!.votes || [];
      dbCache!.history = dbCache!.history || [];
      dbCache!.sessions = dbCache!.sessions || {};
      dbCache!.settings = { ...defaultSettings, ...dbCache!.settings };
      dbCache!.admins = dbCache!.admins || ["8939863862"]; // Initial SUPER ADMIN ID
      return dbCache!;
    } catch (e) {
      console.error("DB Parsing error, creating new db...", e);
    }
  }

  // Fallback to new
  dbCache = {
    users: {},
    movies: [],
    serials: [],
    channels: [],
    support: [],
    requests: [],
    logs: [
      {
        id: Math.random().toString(),
        timestamp: new Date().toISOString(),
        action: "Database Initialized",
        details: "Tizim ma'lumotlar bazasi muvaffaqiyatli yaratildi",
      },
    ],
    settings: defaultSettings,
    votes: [],
    history: [],
    sessions: {},
    admins: ["8939863862"], // Initial SUPER ADMIN ID
  };
  saveDbImmediately();
  return dbCache;
}

export function saveDbImmediately(): void {
  if (!dbCache) return;
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbCache, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save DB instantly:", err);
  }
}

export function saveDb(): void {
  if (saveTimeout) {
    return; // Already pending
  }
  saveTimeout = setTimeout(() => {
    saveDbImmediately();
    saveTimeout = null;
  }, 2000); // 2 second debounce
}

// LOG SYSTEM HELPER
export function addLog(action: string, details: string, admin_id?: string, admin_name?: string): void {
  const db = loadDb();
  db.logs.unshift({
    id: Math.random().toString().slice(2, 11),
    timestamp: new Date().toISOString(),
    admin_id,
    admin_name,
    action,
    details,
  });
  // Cap at 1000 logs
  if (db.logs.length > 1000) {
    db.logs = db.logs.slice(0, 1000);
  }
  saveDb();
}
