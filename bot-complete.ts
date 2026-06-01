import express from "express";
import path from "path";
import fs from "fs";
import TelegramBot from "node-telegram-bot-api";

// ==========================================
// ⚙️ SYSTEM CONFIG DETAILS & CREDENTIALS
// ==========================================
const BOT_TOKEN = "8802513773:AAEOREvLRKmuDqN-ADQe4Sq2XD9qVryLItg";
const SUPER_ADMIN_ID = "8939863862";
const PORT = 3000;

// ==========================================
// 🗄️ DATABASE TYPES AND LOCAL STORAGE ENGINE
// ==========================================
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
  file_id: string;
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
  id: string;
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
  telegram_id: string;
  type: "channel" | "group" | "private" | "instagram" | "youtube";
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
  is_active: boolean;
  app_url?: string;
}

export interface Vote {
  user_id: string;
  movie_id: number;
  is_serial: boolean;
  type: "like" | "dislike" | "fav";
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
  admins: string[];
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
      dbCache!.admins = dbCache!.admins || [SUPER_ADMIN_ID];
      return dbCache!;
    } catch (e) {
      console.error("DB Parsing error, creating new db...", e);
    }
  }

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
    admins: [SUPER_ADMIN_ID],
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
    return;
  }
  saveTimeout = setTimeout(() => {
    saveDbImmediately();
    saveTimeout = null;
  }, 2000);
}

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
  if (db.logs.length > 1000) {
    db.logs = db.logs.slice(0, 1000);
  }
  saveDb();
}

// ==========================================
// 🤖 TELEGRAM BOT MANAGEMENT ENGINE
// ==========================================
let bot: TelegramBot | null = null;
export let botInitError: string | null = null;
export let isBotPolling = false;
export let botUsername = "ultrakinolarbot";

const userLastMessageTime: Record<string, number> = {};
const FLOOD_LIMIT_MS = 1000;
const userActiveState: Record<string, "idle" | "support" | "request"> = {};

interface AdminWizardSession {
  action: "waiting_broadcast" | "adding_movie" | "adding_serial" | "adding_channel";
  step: number;
  data: any;
}
const adminActiveStates: Record<string, AdminWizardSession> = {};

export function getBotStatus() {
  if (botInitError) return `XATO: ${botInitError}`;
  if (isBotPolling) return "FAOL (Polling)";
  return "FAOL (Webhook/Service)";
}

export function initBot(token: string) {
  if (!token || token.trim() === "") {
    botInitError = "Telegram token kiritilmagan.";
    console.error(botInitError);
    return null;
  }

  try {
    const isProd = process.env.NODE_ENV === "production" || !!process.env.APP_URL;
    let selectedMode = "Polling";

    if (isProd) {
      const appUrl = process.env.APP_URL || "";
      if (appUrl && appUrl.startsWith("http")) {
        bot = new TelegramBot(token, { polling: false });
        isBotPolling = false;
        botInitError = null;
        selectedMode = "Webhook";

        const webhookUrl = `${appUrl.trim()}/api/telegram/webhook`;
        bot.setWebHook(webhookUrl).then(() => {
          console.log(`Telegram Webhook set to: ${webhookUrl}`);
          addLog("Bot Tizimi", `Telegram Webhook muvaffaqiyatli o'rnatildi: ${webhookUrl}`);
        }).catch((err: any) => {
          console.error(`Error setting Telegram Webhook to ${webhookUrl}:`, err);
          addLog("Bot Xatoliq", `Webhook o'rnatishda xatolik: ${err.message || err}`);
        });
      } else {
        console.warn("APP_URL not set or invalid, resorting to polling mode.");
        bot = new TelegramBot(token, { polling: true });
        isBotPolling = true;
      }
    } else {
      console.log("Starting Telegram Bot in POLLING mode...");
      bot = new TelegramBot(token, { polling: true });
      isBotPolling = true;
      botInitError = null;
    }

    bot.on("polling_error", (error: any) => {
      console.error("Telegram Polling Error:", error.message || error);
      addLog("Bot Polling Xatosi", `Polling xatosi: ${error.message || error}`);
    });

    bot.on("webhook_error", (error: any) => {
      console.error("Telegram Webhook Error:", error.message || error);
      addLog("Bot Webhook Xatosi", `Webhook xatosi: ${error.message || error}`);
    });

    bot.on("error", (error: any) => {
      console.error("Telegram General Error:", error.message || error);
    });
    
    bot.getMe().then((me) => {
      botUsername = me.username || "ultrakinolarbot";
      console.log(`Bot username set to: @${botUsername}`);
    }).catch((err) => {
      console.error("Could not fetch bot username:", err);
    });

    console.log(`Telegram Bot muvaffaqiyatli ulandi (${selectedMode})!`);
    addLog("Bot tizimi", `Telegram Bot ishga tushirildi (${selectedMode}).`);

    // Notify Admins
    const db = loadDb();
    db.admins.forEach((adminId) => {
      bot?.sendMessage(
        Number(adminId),
        `🔔 *Bot Tizimi ishga tushdi!*\n\nTuri: *${selectedMode}* ko'rinishida muvaffaqiyatli ulangan.\nBarcha tizimlar soz holatda.`,
        { parse_mode: "Markdown" }
      ).catch((err) => console.log(`Start xabari admin ${adminId} ga yetkazilmadi:`, err.message));
    });

    setupBotHandlers();
  } catch (err: any) {
    botInitError = err.message || String(err);
    console.error("Telegram Bot initialization error:", err);
  }

  return bot;
}

export function getBot() {
  return bot;
}

export async function checkSingleSubscription(userId: string, channel: MandatoryChannel): Promise<boolean> {
  if (!bot) return true;
  if (channel.type !== "channel" && channel.type !== "group" && channel.type !== "private") {
    return true; 
  }

  try {
    const member = await bot.getChatMember(channel.telegram_id, Number(userId));
    const allowed = ["member", "administrator", "creator"];
    return allowed.includes(member.status);
  } catch (err) {
    console.warn(`Obunani tekshirishda xato (${channel.name}):`, err);
    return false;
  }
}

export async function checkAllSubscriptions(userId: string): Promise<{ success: boolean; unsubscribed: MandatoryChannel[] }> {
  const db = loadDb();
  if (db.admins.includes(userId)) {
    return { success: true, unsubscribed: [] };
  }

  const user = db.users[userId];
  if (user && user.is_premium) {
    return { success: true, unsubscribed: [] };
  }

  const unsubscribed: MandatoryChannel[] = [];
  for (const channel of db.channels) {
    const isSubscribed = await checkSingleSubscription(userId, channel);
    if (!isSubscribed) {
      unsubscribed.push(channel);
    }
  }

  return {
    success: unsubscribed.length === 0,
    unsubscribed
  };
}

async function sendAdminPanel(chatId: number) {
  if (!bot) return;
  const db = loadDb();
  const activeStatusText = db.settings.is_active ? "🟢 FAOL" : "🔴 TEXNIK TANAFFUS";
  const inline = [
    [
      { text: "📊 Statistika", callback_data: "admin_tg_stats" },
      { text: "📣 Xabar yuborish", callback_data: "admin_tg_broadcast" }
    ],
    [
      { text: "📢 Majburiy obunalar", callback_data: "admin_tg_channels" },
      { text: "📝 Zayafkalar (So'rovlar)", callback_data: "admin_tg_requests" }
    ],
    [
      { text: "🎬 Kino/Serial Qo'shish", callback_data: "admin_tg_add_content" },
      { text: `⚠️ Bot Holati: ${activeStatusText}`, callback_data: "admin_tg_toggle_bot" }
    ]
  ];

  await bot.sendMessage(
    chatId,
    "👮 *ADMIN PANEL (TELEGRAM MENYUSI)* 👮\n\nHurmatli admin, botni qulay va to'g'ridan-to'g'ri Telegram orqali boshqarish tizimiga xush kelibsiz!",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: inline
      }
    }
  );
}

function getMainMenu(userId: string) {
  const db = loadDb();
  const isAdmin = db.admins.includes(userId);

  const keyboard: any[][] = [
    [{ text: "🔍 Kino qidirish" }, { text: "🎬 Yangi kinolar" }],
    [{ text: "🏆 Top kinolar" }, { text: "🎲 Tasodifiy kino" }],
    [{ text: "📚 Janrlar" }, { text: "📺 Seriallar" }],
    [{ text: "❤️ Sevimlilar" }, { text: "👤 Profil" }],
    [{ text: "🎁 Referal" }, { text: "📝 Kino so'rash" }],
    [{ text: "💬 Support" }, { text: "📜 Tarix" }]
  ];

  if (isAdmin) {
    const appUrl = db.settings.app_url || process.env.APP_URL || "";
    keyboard.push([
      { text: "👮 Admin Panel (Mini App)", web_app: { url: appUrl } },
      { text: "👮 Admin (Telegram)" }
    ]);
  }

  return {
    keyboard,
    resize_keyboard: true,
  };
}

function setupBotHandlers() {
  if (!bot) return;

  bot.on("message", async (msg) => {
    if (!bot) return;
    const userId = String(msg.from?.id);
    if (!userId || userId === "undefined" || msg.from?.is_bot) return;

    const db = loadDb();
    const isAdmin = db.admins.includes(userId);

    // Tech Break check
    if (!db.settings.is_active && !isAdmin) {
      bot.sendMessage(msg.chat.id, "🛠 *Bot texnik ishlar sababli vaqtincha ishlamayapti.*\n\nTez orada qayta ishga tushiramiz. Sabringiz uchun rahmat!", { parse_mode: "Markdown" });
      return;
    }

    // Flood limits
    const now = Date.now();
    const lastMsgTime = userLastMessageTime[userId] || 0;
    if (now - lastMsgTime < FLOOD_LIMIT_MS) {
      await bot.sendMessage(msg.chat.id, "⚠️ *Iltimos, ketma-ket tez yozmang.* Soniyasiga 1 tadan xabar yuborish ruxsat etilgan.", { parse_mode: "Markdown" });
      userLastMessageTime[userId] = now;
      return;
    }
    userLastMessageTime[userId] = now;

    // User check / save
    const isBrandNew = !db.users[userId];
    let user = db.users[userId];
    if (!user) {
      user = {
        id: userId,
        username: msg.from?.username,
        first_name: msg.from?.first_name,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        referrals_count: 0,
        is_banned: false,
        is_premium: false
      };
      db.users[userId] = user;
      saveDb();
    } else {
      user.last_active_at = new Date().toISOString();
      user.username = msg.from?.username || user.username;
      user.first_name = msg.from?.first_name || user.first_name;
      saveDb();
    }

    if (user.is_banned) {
      await bot.sendMessage(msg.chat.id, "❌ *Siz ushbu botdan bloklangansiz!* Qoidabuzarlik tufayli sizga botdan foydalanish taqiqlangan.", { parse_mode: "Markdown" });
      return;
    }

    const rawText = msg.text || msg.caption || "";
    const text = rawText.trim();
    if (!text) return;

    // Security Gatekeeper for unauthorized requests
    const isTryingAdmin = text === "/admin" || text === "👮 Admin (Telegram)" || text.startsWith("/tgsendall") || text.split(" ")[0].startsWith("#add");
    if (isTryingAdmin && !isAdmin) {
      await bot.sendMessage(msg.chat.id, "❌ *Xatolik:* Siz ushbu bot administratori emassiz! Admin panel faqat tasdiqlangan Admin ID raqamlariga ruxsat beradi.", { parse_mode: "Markdown" });
      return;
    }

    // Wizard Cancel check
    if (isAdmin && (text === "/cancel" || text.toLowerCase() === "bekor qilish")) {
      if (adminActiveStates[userId]) {
        delete adminActiveStates[userId];
        await bot.sendMessage(msg.chat.id, "❌ *Faol adminlik jarayoni bekor qilindi.* Yangi buyruq berish uchun /admin bosing.", { parse_mode: "Markdown" });
        return;
      }
    }

    // ACTIVE WIZARD INPUT INTERPRETATION (ADMIN SIDE)
    if (isAdmin && adminActiveStates[userId]) {
      const session = adminActiveStates[userId];

      if (session.action === "waiting_broadcast") {
        session.data = {
          text: msg.text,
          photo: msg.photo,
          video: msg.video,
          audio: msg.audio,
          document: msg.document,
          caption: msg.caption
        };
        session.step = 2;
        await bot.sendMessage(
          msg.chat.id,
          `📝 *Kiritilgan xabar qabul qilindi!*\n\nUshbu postni barcha foydalanuvchilarga tarqatamizmi?`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Ha, yuborilsin", callback_data: "admin_confirm_tg_broadcast" },
                  { text: "❌ Yo'q, bekor qilish", callback_data: "admin_cancel_tg_broadcast" }
                ]
              ]
            }
          }
        );
        return;
      }

      if (session.action === "adding_movie") {
        if (session.step === 1) {
          session.data.title = text;
          session.step = 2;
          await bot.sendMessage(msg.chat.id, "🔢 *2-Qadam:* Ushbu kino uchun yuklash kod(lar)ini kiriting (Agar bir nechta bo'lsa o'rtasiga vergul qo'ying, masalan `1020, spider3`):");
          return;
        }
        if (session.step === 2) {
          session.data.codes = text.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
          session.step = 3;
          await bot.sendMessage(msg.chat.id, "🎭 *3-Qadam:* Kino janrini tanlang yoki kiriting (masalan: `Jangari`, `Tarjima`, `Komediya`):", {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "💥 Jangari", callback_data: "admin_mv_genre_Jangari" },
                  { text: "🎭 Komediya", callback_data: "admin_mv_genre_Komediya" }
                ],
                [
                  { text: "🍿 Melodrama", callback_data: "admin_mv_genre_Melodrama" },
                  { text: "🧩 Sarguzasht", callback_data: "admin_mv_genre_Sarguzasht" }
                ],
                [
                  { text: "👻 Qo'rqinchli", callback_data: "admin_mv_genre_Qorqinchli" },
                  { text: "🤖 Fantastika", callback_data: "admin_mv_genre_Fantastika" }
                ]
              ]
            }
          });
          return;
        }
        if (session.step === 3) {
          session.data.genre = text;
          session.step = 4;
          await bot.sendMessage(msg.chat.id, "📅 *4-Qadam:* Kino chiqarilgan yilini kiriting (masalan: `2024`):");
          return;
        }
        if (session.step === 4) {
          session.data.year = Number(text) || new Date().getFullYear();
          session.step = 5;
          await bot.sendMessage(msg.chat.id, "⭐ *5-Qadam:* Kino IMDB reytingini kiriting (masalan: `8.5`):");
          return;
        }
        if (session.step === 5) {
          session.data.rating = Number(text) || 7.5;
          session.step = 6;
          await bot.sendMessage(msg.chat.id, "📝 *6-Qadam:* Kino qisqacha tavsifi (syujeti)ni yozing:");
          return;
        }
        if (session.step === 6) {
          session.data.description = text;
          session.step = 7;
          await bot.sendMessage(
            msg.chat.id,
            "🎦 *7-Qadam:* Kino faylini yuboring yoki video yuklash havolasini kiriting:\n\n💡 _Tavsiya: To'g'ridan-to'g'ri kino faylini (video, kinoni o'zi) yuklab yuborsangiz, uning Telegram ID raqamini o'zimiz aniqlab olamiz!_"
          );
          return;
        }
        if (session.step === 7) {
          let fileIdOrUrl = text;
          if (msg.video) {
            fileIdOrUrl = msg.video.file_id;
          } else if (msg.document) {
            fileIdOrUrl = msg.document.file_id;
          }
          session.data.fileVal = fileIdOrUrl;
          session.step = 8;
          await bot.sendMessage(msg.chat.id, "🖼 *8-Qadam:* Kino posterining rasmini yoki havolasini yozing (yoki o'tkazib yuborish uchun `/skip` deb yozing):");
          return;
        }
        if (session.step === 8) {
          session.data.poster = text === "/skip" ? "" : text;
          session.step = 9;
          await bot.sendMessage(msg.chat.id, "📹 *9-Qadam:* Kino rasmiy treyleri (Youtube) havolasini yozing (yoki o'tkazib yuborish uchun `/skip` deb yozing):");
          return;
        }
        if (session.step === 9) {
          session.data.trailer = text === "/skip" ? "" : text;
          
          const movieData = session.data;
          let summary = `🎬 *YANGI KINO MA'LUMOTLARI VERIFIKATSIYASI* 🎬\n\n` +
            `• Nomi: *${movieData.title}*\n` +
            `• Yuklash Kodlari: ${movieData.codes.map((c: string) => `\`${c}\``).join(", ")}\n` +
            `• Janri: *${movieData.genre}*\n` +
            `• Yili: *${movieData.year}*\n` +
            `• Reyting: *${movieData.rating}*\n` +
            `• Tavsif: _${movieData.description}_\n` +
            `• Poster: ${movieData.poster ? "Bor ✅" : "Yo'q ❌"}\n` +
            `• Treyler: ${movieData.trailer ? "Bor ✅" : "Yo'q ❌"}\n\n` +
            `Ushbu yangi kinoni saqlaymizmi?`;

          await bot.sendMessage(msg.chat.id, summary, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Ha, saqlansin", callback_data: "admin_confirm_save_movie" },
                  { text: "❌ Yo'q, bekor qilish", callback_data: "admin_cancel_tg_broadcast" }
                ]
              ]
            }
          });
          return;
        }
      }

      if (session.action === "adding_serial") {
        if (session.step === 1) {
          session.data.title = text;
          session.step = 2;
          await bot.sendMessage(msg.chat.id, "🔢 *2-Qadam:* Serial yuklash kod(lar)ini kiriting (vergul bilan ajrating, masalan `5501, srl`):");
          return;
        }
        if (session.step === 2) {
          session.data.codes = text.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
          session.step = 3;
          await bot.sendMessage(msg.chat.id, "🎭 *3-Qadam:* Serial janrini kiriting (masalan: `Drama`, `Koreys`):");
          return;
        }
        if (session.step === 3) {
          session.data.genre = text;
          session.step = 4;
          await bot.sendMessage(msg.chat.id, "📅 *4-Qadam:* Serial chiqarilgan yilini kiriting (masalan: `2024`):");
          return;
        }
        if (session.step === 4) {
          session.data.year = Number(text) || new Date().getFullYear();
          session.step = 5;
          await bot.sendMessage(msg.chat.id, "⭐ *5-Qadam:* Serial IMDB reytingini kiriting (masalan: `8.0`):");
          return;
        }
        if (session.step === 5) {
          session.data.rating = Number(text) || 7.5;
          session.step = 6;
          await bot.sendMessage(msg.chat.id, "📝 *6-Qadam:* Serial batafsil tavsifini yozing:");
          return;
        }
        if (session.step === 6) {
          session.data.description = text;
          session.step = 7;
          await bot.sendMessage(
            msg.chat.id,
            "📺 *7-Qadam (BIRINCHI QISM):*\n\nFasl raqamini, qism raqamini, qism nomini va video faylining o'zini (yoki yuklash havolasini) quyidagi ko'rinishda yuboring:\n\n`Fasl:Qism:Qism_Nomi:Havolasi` (Masalan: `1:1:Uchrashuv:https://t.me/...`)\n\n*Muhim:* Agar video faylni shu yerga to'g'ridan-to'g'ri yuklasangiz, uning ma'lumoti 1-Fasl, 1-Qism (`Ep1`) deb tayyorlab olinadi!"
          );
          return;
        }
        if (session.step === 7) {
          let season_num = 1;
          let episode_num = 1;
          let title = "1-Qism";
          let file_id = text;

          if (msg.video) {
            file_id = msg.video.file_id;
          } else if (msg.document) {
            file_id = msg.document.file_id;
          } else {
            const parts = text.split(":");
            if (parts.length >= 4) {
              season_num = Number(parts[0]) || 1;
              episode_num = Number(parts[1]) || 1;
              title = parts[2] || `${episode_num}-qism`;
              file_id = parts.slice(3).join(":").trim();
            }
          }

          session.data.episode = { season_num, episode_num, title, file_id };
          session.step = 8;
          await bot.sendMessage(msg.chat.id, "🖼 *8-Qadam:* Serial posteri rasmini yoki havolasini yozing (yoki o'tkazib yuborish uchun `/skip`):");
          return;
        }
        if (session.step === 8) {
          session.data.poster = text === "/skip" ? "" : text;
          session.step = 9;
          await bot.sendMessage(msg.chat.id, "📹 *9-Qadam:* Serial treyleri havolasini yozing (yoki o'tkazib yuborish uchun `/skip`):");
          return;
        }
        if (session.step === 9) {
          session.data.trailer = text === "/skip" ? "" : text;

          const serialData = session.data;
          let summary = `📺 *YANGI SERIAL MA'LUMOTLARI VERIFIKATSIYASI* 📺\n\n` +
            `• Nomi: *${serialData.title}*\n` +
            `• Yuklash Kodlari: ${serialData.codes.map((c: string) => `\`${c}\``).join(", ")}\n` +
            `• Janri: *${serialData.genre}*\n` +
            `• Yili: *${serialData.year}*\n` +
            `• Reyting: *${serialData.rating}*\n` +
            `• Birinchi Epizod: Fasl ${serialData.episode.season_num}, Qism ${serialData.episode.episode_num} ("${serialData.episode.title}")\n\n` +
            `Ushbu serial ma'lumotlarini saqlaymizmi?`;

          await bot.sendMessage(msg.chat.id, summary, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Serialni saqlash", callback_data: "admin_confirm_save_serial" },
                  { text: "❌ Bekor qilish", callback_data: "admin_cancel_tg_broadcast" }
                ]
              ]
            }
          });
          return;
        }
      }

      if (session.action === "adding_channel") {
        if (session.step === 1) {
          session.data.name = text;
          session.step = 2;
          await bot.sendMessage(msg.chat.id, "🔗 *2-Qadam:* Ushbu kanalning havolasini (linkini) kiriting (`https://t.me/...`):");
          return;
        }
        if (session.step === 2) {
          session.data.url = text;
          session.step = 3;
          await bot.sendMessage(msg.chat.id, "🔒 *3-Qadam:* Hamkorlik kanalining turini tanlang:", {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📢 Ommaviy Kanal (Channel)", callback_data: "admin_chan_type_channel" },
                  { text: "🔒 Maxfiy/Yopiq Kanal (Private)", callback_data: "admin_chan_type_private" }
                ],
                [
                  { text: "👥 Telegram Guruh (Group)", callback_data: "admin_chan_type_group" },
                  { text: "📸 Instagram Tarmoq", callback_data: "admin_chan_type_instagram" }
                ],
                [{ text: "🔴 Youtube Kanal", callback_data: "admin_chan_type_youtube" }]
              ]
            }
          });
          return;
        }
        if (session.step === 3) {
          session.data.type = text;
          session.step = 4;
          await bot.sendMessage(msg.chat.id, "🆔 *4-Qadam:* Kanalning unikal Telegram ID raqamini kiriting (masalan `-100xxxxxxxxxx`. Telegram tarmog'i bo'lmasa, shunchaki `yo'q` deb yozing):");
          return;
        }
        if (session.step === 4) {
          session.data.telegram_id = text;

          const chanData = session.data;
          let summary = `📢 *YANGI MAJBURIY OBUNA VERIFIKATSIYASI* 📢\n\n` +
            `• Nomi: *${chanData.name}*\n` +
            `• Turi: *${chanData.type.toUpperCase()}*\n` +
            `• Havola: ${chanData.url}\n` +
            `• ID: \`${chanData.telegram_id}\`\n\n` +
            `Ushbu hamkor kanalini majburiy qaydlar safiga saqlaymizmi?`;

          await bot.sendMessage(msg.chat.id, summary, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Kanalni qo'shish", callback_data: "admin_confirm_save_channel" },
                  { text: "❌ Bekor qilish", callback_data: "admin_cancel_tg_broadcast" }
                ]
              ]
            }
          });
          return;
        }
      }
    }

    // ADMIN DIRECT CONTROL COMMANDS
    if (isAdmin) {
      if (text === "/admin" || text === "👮 Admin (Telegram)") {
        await sendAdminPanel(msg.chat.id);
        return;
      }

      if (text.startsWith("/tgsendall")) {
        const contentText = text.replace("/tgsendall", "").trim();
        await bot.sendMessage(msg.chat.id, "⏳ *Xabar tarqatish boshlandi...* Iltimos, yakunlanishini kuting. Barcha a'zolarga yuborilmoqda.", { parse_mode: "Markdown" });
        
        const allUserIds = Object.keys(db.users);
        let successCount = 0;
        let failCount = 0;

        for (const targetId of allUserIds) {
          try {
            if (msg.photo && msg.photo.length > 0) {
              const fileId = msg.photo[msg.photo.length - 1].file_id;
              await bot.sendPhoto(targetId, fileId, { caption: contentText || undefined, parse_mode: "Markdown" });
            } else if (msg.video) {
              await bot.sendVideo(targetId, msg.video.file_id, { caption: contentText || undefined, parse_mode: "Markdown" });
            } else {
              await bot.sendMessage(targetId, contentText, { parse_mode: "Markdown" });
            }
            successCount++;
          } catch (err) {
            failCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 35));
        }

        await bot.sendMessage(
          msg.chat.id,
          `✅ *Xabar barchaga yuborib bo'lindi!*\n\n• Muvaffaqiyatli: *${successCount}* ta\n• Muammo: *${failCount}* ta\n• Jami: *${allUserIds.length}* ta.`,
          { parse_mode: "Markdown" }
        );
        addLog("Admin Telegram Broadcast", `Admin barcha ${allUserIds.length} foydalanuvchiga xabar yuborishni tugatdi.`);
        return;
      }

      if (text.startsWith("#addchannel")) {
        const parts = text.replace("#addchannel", "").split("|").map(x => x.trim());
        if (parts.length < 4) {
          await bot.sendMessage(msg.chat.id, "⚠️ *Noto'g'ri format!* Ishlating: `#addchannel Nomi | Havola | Telegram_ID | Turi`", { parse_mode: "Markdown" });
          return;
        }
        const [name, url, telegram_id, type] = parts;
        const newChan = {
          id: Math.random().toString().slice(2, 9),
          name,
          url,
          telegram_id: telegram_id || "yo'q",
          type: type as any
        };
        db.channels.push(newChan);
        saveDb();
        await bot.sendMessage(msg.chat.id, `✅ *Yangi majburiy a'zolik muvaffaqiyatli qo'shildi!*\n\n• Nomi: *${name}*\n• Turi: *${type.toUpperCase()}*`, { parse_mode: "Markdown" });
        addLog("Admin Telegram Channel", `Admin kanal qo'shdi: ${name}`);
        return;
      }

      if (text.startsWith("#addmovie")) {
        const parts = text.replace("#addmovie", "").split("|").map(x => x.trim());
        if (parts.length < 7) {
          await bot.sendMessage(msg.chat.id, "⚠️ *Noto'g'ri format!* Kamida 7ta ma'lumot jo'nating:\n`#addmovie Sarlavha | Kodlar (vergul bilan) | Janr | Yil | Reyting | Tavsif | Sifat:FileID` [| Poster | Trailer]", { parse_mode: "Markdown" });
          return;
        }
        const [title, codesStr, genre, yearStr, ratingStr, description, qualityStr, poster, trailer] = parts;
        const codes = codesStr.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
        const year = Number(yearStr) || new Date().getFullYear();
        const rating = Number(ratingStr) || 8.0;

        const qualityArr = qualityStr.split(":");
        const qualityKey = qualityArr[0].trim() || "Full HD";
        const qualityValue = qualityArr.slice(1).join(":").trim() || "https://t.me/c/unknown";

        const newMovie = {
          id: db.movies.length > 0 ? Math.max(...db.movies.map((m: any) => m.id), 0) + 1 : 1001,
          codes,
          title,
          description,
          genre,
          year,
          rating,
          video_quality_urls: { [qualityKey]: qualityValue },
          poster_url: poster || "",
          trailer_url: trailer || "",
          views: 0,
          downloads: 0,
          likes: 0,
          dislikes: 0
        };

        db.movies.push(newMovie);
        saveDb();
        await bot.sendMessage(msg.chat.id, `✅ *Yangi kino muvaffaqiyatli qo'shildi!*\n\n• ID: *${newMovie.id}*\n• Nomi: *${title}*`, { parse_mode: "Markdown" });
        addLog("Admin Telegram Movie", `Admin oson buyruq bilan kino qo'shdi: ${title}`);
        return;
      }
    }

    // SUPPORT REPLY DETECTOR (ADMIN SIDE FORWARDED HEADERS)
    if (isAdmin && msg.reply_to_message) {
      const replyText = msg.reply_to_message.text || "";
      const match = replyText.match(/Foydalanuvchi ID:\s*([0-9]+)/) || replyText.match(/Tashrifchi ID:\s*([0-9]+)/) || replyText.match(/Tashrifchi:\s*([0-9]+)/);
      if (match && match[1]) {
        const targetUserId = match[1];
        const ticket = db.support.find(t => t.user_id === targetUserId && t.status !== "Yopilgan");
        if (ticket) {
          ticket.messages.push({
            sender: "admin",
            text: text,
            timestamp: new Date().toISOString()
          });
          ticket.last_updated = new Date().toISOString();
          saveDb();

          bot.sendMessage(
            Number(targetUserId),
            `💬 *Admin javobi:*\n\n${text}\n\n_Savollaringiz bo'lsa yozishda davom etishingiz mumkin._`,
            { parse_mode: "Markdown" }
          ).then(() => {
            bot?.sendMessage(msg.chat.id, "✅ Javob muvaffaqiyatli yuborildi.");
            addLog("Support javoblandi", `Foydalanuvchi ${targetUserId} telegram orqali javoblandi.`);
          }).catch((err) => {
            bot?.sendMessage(msg.chat.id, `❌ Yuborishda xato: ${err.message}`);
          });
          return;
        }
      }
    }

    // SYSTEM NAVIGATION ENTRY POINTS
    if (text.startsWith("/start")) {
      const match = text.match(/^\/start ref_([0-9]+)$/);
      if (match && match[1]) {
        const referrerId = match[1];
        if (referrerId !== userId && isBrandNew && !user.referred_by) {
          user.referred_by = referrerId;
          const referrer = db.users[referrerId];
          if (referrer) {
            referrer.referrals_count += 1;
            if (referrer.referrals_count >= 10 && !referrer.is_premium) {
              referrer.is_premium = true;
              bot.sendMessage(
                Number(referrerId),
                "🎉 *Tabriklaymiz!* Siz 10 ta referal yig'dingiz va bepul *VIP PREMIUM* maqomiga ega bo'ldingiz!",
                { parse_mode: "Markdown" }
              );
            } else {
              bot.sendMessage(
                Number(referrerId),
                `👥 *Yangi referal qo'shildi!*\n\nDo'stingiz botga kirdi. Jami referallaringiz: *${referrer.referrals_count}/10* ta.\n_10 ta do'st taklif qiling va bepul VIP Premium oling!_`,
                { parse_mode: "Markdown" }
              ).catch(() => {});
            }
          }
          saveDb();
        }
      }

      await bot.sendMessage(
        msg.chat.id,
        `👋 ${db.settings.start_msg}`,
        {
          parse_mode: "Markdown",
          reply_markup: getMainMenu(userId)
        }
      );
      return;
    }

    // SUBSCRIPTION VERIFICATION MIDDLEWARE BLOCK
    if (!text.startsWith("💬 Support") && !text.startsWith("👤 Profil") && !text.startsWith("🎁 Referal")) {
      const check = await checkAllSubscriptions(userId);
      if (!check.success) {
        let textChannels = "🛑 *Botdan foydalanish uchun rasmiy kanallarimizga a'zo bo'lishingiz shart!*\n\nKanallarga qo'shiling va keyin *'✅ A'zo bo'ldim'* tugmasini bosing:\n\n";
        const inlineKeyboard: any[] = [];
        
        check.unsubscribed.forEach((channel, idx) => {
          let icon = "📢";
          let label = "Kanalga a'zo bo'lish";
          if (channel.type === "group") { icon = "👥"; label = "Guruhga a'zo bo'lish"; }
          else if (channel.type === "instagram") { icon = "📸"; label = "Instagramda kuzatish"; }
          else if (channel.type === "youtube") { icon = "🔴"; label = "YouTubega obuna bo'lish"; }
          
          textChannels += `${idx + 1}. ${icon} *${channel.name}*\n`;
          inlineKeyboard.push([{ text: `🔗 ${icon} ${label}`, url: channel.url }]);
        });

        inlineKeyboard.push([{ text: "✅ A'zo bo'ldim", callback_data: "check_channels_join" }]);

        await bot.sendMessage(msg.chat.id, textChannels, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
        return;
      }
    }

    // PRIMARY COMMAND FLOWS
    switch (text) {
      case "🔍 Kino qidirish":
        userActiveState[userId] = "idle";
        await bot.sendMessage(
          msg.chat.id,
          "🔍 *Kino qidirish tizimi:*\n\nKino yoki serial kodini kiriting (masalan: `1001`, `AVATAR`). Nominal nomini ham kiritishingiz mumkin.",
          { parse_mode: "Markdown" }
        );
        break;

      case "🎬 Yangi kinolar":
        userActiveState[userId] = "idle";
        await showNewMovies(msg.chat.id);
        break;

      case "🏆 Top kinolar":
        userActiveState[userId] = "idle";
        await showTopMovies(msg.chat.id);
        break;

      case "🎲 Tasodifiy kino":
        userActiveState[userId] = "idle";
        await showRandomMovie(msg.chat.id, userId);
        break;

      case "📚 Janrlar":
        userActiveState[userId] = "idle";
        await showGenresList(msg.chat.id);
        break;

      case "📺 Seriallar":
        userActiveState[userId] = "idle";
        await showSerialsList(msg.chat.id);
        break;

      case "❤️ Sevimlilar":
        userActiveState[userId] = "idle";
        await showFavorites(msg.chat.id, userId);
        break;

      case "👤 Profil":
        userActiveState[userId] = "idle";
        await showProfile(msg.chat.id, userId);
        break;

      case "🎁 Referal":
        userActiveState[userId] = "idle";
        await showReferral(msg.chat.id, userId);
        break;

      case "📝 Kino so'rash":
        userActiveState[userId] = "request";
        await bot.sendMessage(
          msg.chat.id,
          "📝 *Kino so'rash (Zayafka) bo'limi:*\n\nBotda siz istagan kino topilmadimi? Bizga yozing!\n\n*Kino nomini to'g'ridan-to'g'ri shu yerga yozib yuborishingiz mumkin!*",
          { parse_mode: "Markdown" }
        );
        break;

      case "💬 Support":
        userActiveState[userId] = "support";
        await bot.sendMessage(
          msg.chat.id,
          `💬 *Aloqa (Support) bo'limi:*\n\nSavollaringizni to'g'ridan-to'g'ri yozib yuborishingiz mumkin.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "📜 Tarix":
        userActiveState[userId] = "idle";
        await showHistory(msg.chat.id, userId);
        break;

      default: {
        const isSorash = text.startsWith("/sorash") || userActiveState[userId] === "request";
        const isSavol = text.startsWith("/savol") || userActiveState[userId] === "support";

        if (isSorash) {
          const reqTitle = text.startsWith("/sorash") ? text.replace("/sorash", "").trim() : text.trim();
          if (!reqTitle) {
            await bot.sendMessage(msg.chat.id, "⚠️ Iltimos, so'rayotgan kino nomini kiriting.", { parse_mode: "Markdown" });
          } else {
            const reqId = Math.random().toString().slice(2, 9);
            db.requests.push({
              id: reqId,
              user_id: userId,
              username: msg.from?.username || "",
              movie_title: reqTitle,
              status: "Kutilmoqda",
              created_at: new Date().toISOString()
            });
            saveDb();
            userActiveState[userId] = "idle";

            await bot.sendMessage(
              msg.chat.id,
              `✅ *Sizning so'rovingiz qabul qilindi!*\n\nKino: *${reqTitle}*\nSo'rov kodi: *#REQ${reqId}*`,
              { parse_mode: "Markdown" }
            );
            addLog("Mijoz zayafkasi", `User ${userId} kino so'radi: ${reqTitle}`);
          }
        } else if (isSavol) {
          const qText = text.startsWith("/savol") ? text.replace("/savol", "").trim() : text.trim();
          if (!qText) {
            await bot.sendMessage(msg.chat.id, "⚠️ Iltimos, savolingizni yozing.", { parse_mode: "Markdown" });
          } else {
            let ticket = db.support.find(t => t.user_id === userId && t.status !== "Yopilgan");
            if (!ticket) {
              ticket = {
                id: Math.random().toString().slice(2, 9),
                user_id: userId,
                username: msg.from?.username || "",
                first_name: msg.from?.first_name || "",
                status: "Kutilmoqda",
                messages: [],
                last_updated: new Date().toISOString()
              };
              db.support.push(ticket);
            }
            ticket.messages.push({
              sender: "user",
              text: qText,
              timestamp: new Date().toISOString()
            });
            ticket.status = "Kutilmoqda";
            ticket.last_updated = new Date().toISOString();
            saveDb();

            await bot.sendMessage(msg.chat.id, "📨 *Sizning murojaatingiz adminga yetkazildi!* Tezorada javob berishadi.", { parse_mode: "Markdown" });
            
            // Forward support to all admins
            db.admins.forEach(adminId => {
              bot?.sendMessage(
                Number(adminId),
                `💬 *Yangi Support Murojaati!*\n\nTashrifchi ID: \`${userId}\`\nIsm: *${user.first_name || ""}*\nUsername: @${user.username || "yo'q"}\n\n*Murojaat:* _${qText}_\n\n📌 _Ushbu xabarga 'Reply' orqali yozib javob yo'llashingiz mumkin!_`,
                { parse_mode: "Markdown" }
              ).catch(() => {});
            });
          }
        } else {
          // Regular movie search query has happened!
          await handleSearch(msg.chat.id, userId, text);
        }
      }
    }
  });

  // INTERACTIVE CALLBACK QUERIES CODES
  bot.on("callback_query", async (query) => {
    if (!bot) return;
    const userId = String(query.from.id);
    const data = query.data || "";
    const db = loadDb();
    const isAdmin = db.admins.includes(userId);

    // Dynamic Admin settings callback handles
    if (isAdmin) {
      if (data === "admin_tg_stats") {
        const usersCount = Object.keys(db.users).length;
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(
          query.message!.chat.id,
          `📊 *KINO BOT ONLINE STATISTIKASI:*\n\n• Jami unikal a'zolar: *${usersCount}* ta\n• Jami kinolar: *${db.movies.length}* ta\n• Jami seriallar: *${db.serials.length}* ta\n• Hamkor kanallar: *${db.channels.length}* ta\n• Ochiq murojaatlar: *${db.support.filter(s=>s.status !== "Yopilgan").length}* ta`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      if (data === "admin_tg_broadcast") {
        adminActiveStates[userId] = { action: "waiting_broadcast", step: 1, data: null };
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(query.message!.chat.id, "📣 *Reklama tarqatish yuboruvchisi:*\n\nBarcha bot a'zolariga yubormoqchi bo'lgan xabaringizni yozing yoki rasm, video yuklab yuboring (Caption yozishingiz ham mumkin!):\n\n_Bekor qilish uchun bemalol /cancel deb yozing._");
        return;
      }

      if (data === "admin_confirm_tg_broadcast") {
        const session = adminActiveStates[userId];
        if (!session || session.action !== "waiting_broadcast" || !session.data) {
          await bot.answerCallbackQuery(query.id, { text: "Eski seans bekor bo'lgan!", show_alert: true });
          return;
        }

        await bot.answerCallbackQuery(query.id, { text: "Yuborilish boshlandi..." });
        const msgData = session.data;
        const allUserIds = Object.keys(db.users);
        let successCount = 0;
        let failCount = 0;

        for (const targetId of allUserIds) {
          try {
            if (msgData.photo && msgData.photo.length > 0) {
              const fileId = msgData.photo[msgData.photo.length - 1].file_id;
              await bot.sendPhoto(Number(targetId), fileId, { caption: msgData.caption || undefined, parse_mode: "Markdown" });
            } else if (msgData.video) {
              await bot.sendVideo(Number(targetId), msgData.video.file_id, { caption: msgData.caption || undefined, parse_mode: "Markdown" });
            } else {
              await bot.sendMessage(Number(targetId), msgData.text, { parse_mode: "Markdown" });
            }
            successCount++;
          } catch (err) {
            failCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 35));
        }

        await bot.sendMessage(
          query.message!.chat.id,
          `✅ *Mailing tugallandi!*\n\n• Yetkazilganlar: *${successCount}*\n• Xatolik: *${failCount}*\n• Jami: *${allUserIds.length}*`,
          { parse_mode: "Markdown" }
        );
        delete adminActiveStates[userId];
        return;
      }

      if (data === "admin_tg_channels") {
        await bot.answerCallbackQuery(query.id);
        let textChan = "📢 *MAJBURIY OBUNA KANALLARI:* \n\n";
        db.channels.forEach((c) => {
          textChan += `• *${c.name}* (Turi: ${c.type.toUpperCase()})\nHavola: ${c.url}\n\n`;
        });
        textChan += "💡 _Yangi kanal qo'shish uchun: #addchannel Nomi | Havola | Telegram_ID | Turi_";
        await bot.sendMessage(query.message!.chat.id, textChan, { parse_mode: "Markdown" });
        return;
      }

      if (data === "admin_tg_requests") {
        await bot.answerCallbackQuery(query.id);
        const pending = db.requests.filter(r => r.status === "Kutilmoqda").slice(0, 10);
        if (pending.length === 0) {
          await bot.sendMessage(query.message!.chat.id, "📝 Kutilayotgan yangi kino so'rovlari yo'q.");
          return;
        }
        let txt = "📝 *KUTILAYOTGAN KINO SO'ROVLARI:* \n\n";
        pending.forEach((p) => {
          txt += `• ID: #REQ${p.id}\n👤 User: @${p.username || p.user_id}\n🎬 Sarlavha: *${p.movie_title}*\n\n`;
        });
        await bot.sendMessage(query.message!.chat.id, txt, { parse_mode: "Markdown" });
        return;
      }

      if (data === "admin_tg_add_content") {
        adminActiveStates[userId] = { action: "adding_movie", step: 1, data: {} };
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(query.message!.chat.id, "🎬 *KINO QO'ShISh JADVALI* 🎬\n\n*1-Qadam:* Qo'shmoqchi bo'lgan filmning to'liq sarlavhasini (nomini) kiriting:\n\n_Eslatma: Bekor qilish uchun istalgan vaqt bekor qilish deb yozishingiz mumkin._");
        return;
      }

      if (data.startsWith("admin_mv_genre_")) {
        const genre = data.replace("admin_mv_genre_", "");
        const session = adminActiveStates[userId];
        if (session && session.action === "adding_movie" && session.step === 3) {
          session.data.genre = genre;
          session.step = 4;
          await bot.answerCallbackQuery(query.id, { text: `Tanlandi: ${genre}` });
          await bot.sendMessage(query.message!.chat.id, `✅ Janr tanlandi: *${genre}*\n\n📅 *4-Qadam:* Kino chiqarilgan yilini yozing (masalan \`2024\`):`, { parse_mode: "Markdown" });
          return;
        }
      }

      if (data.startsWith("admin_chan_type_")) {
        const type = data.replace("admin_chan_type_", "");
        const session = adminActiveStates[userId];
        if (session && session.action === "adding_channel" && session.step === 3) {
          session.data.type = type;
          session.step = 4;
          await bot.answerCallbackQuery(query.id);
          await bot.sendMessage(query.message!.chat.id, `✅ Kanal turi o'rnatildi: *${type.toUpperCase()}*\n\n🆔 *4-Qadam:* Ommaviy/Maxfiy guruhning Telegram ID raqamini kiriting (Yoki \`yo'q\` deb yozing):`, { parse_mode: "Markdown" });
          return;
        }
      }

      if (data === "admin_tg_toggle_bot") {
        db.settings.is_active = !db.settings.is_active;
        saveDb();
        const activeText = db.settings.is_active ? "🔴 Botni O'chirish (Texnik tanaffus)" : "🟢 Botni Yoqish (Ish tushirish)";
        await bot.answerCallbackQuery(query.id, { text: `Bot holati o'zgartirildi: ${db.settings.is_active ? "Yoqildi" : "O'chirildi"}` });
        await sendAdminPanel(query.message!.chat.id);
        return;
      }

      if (data === "admin_confirm_save_movie") {
        const session = adminActiveStates[userId];
        if (!session || session.action !== "adding_movie" || !session.data) {
          await bot.answerCallbackQuery(query.id, { text: "Seans aniqlanmadi!", show_alert: true });
          return;
        }
        const mData = session.data;
        const newMovie = {
          id: db.movies.length > 0 ? Math.max(...db.movies.map((m: any) => m.id), 0) + 1 : 1001,
          codes: mData.codes,
          title: mData.title,
          description: mData.description,
          genre: mData.genre,
          year: mData.year,
          rating: mData.rating,
          video_quality_urls: { "Full HD": mData.fileVal },
          poster_url: mData.poster,
          trailer_url: mData.trailer,
          views: 0,
          downloads: 0,
          likes: 0,
          dislikes: 0
        };

        db.movies.push(newMovie);
        saveDb();

        await bot.sendMessage(query.message!.chat.id, `✅ *Kino saqlandi!* Film muvaffaqiyatli drayverlar qatoriga qo'shildi!\n\n• ID: *${newMovie.id}*\n• Nomi: *${newMovie.title}*`);
        addLog("Admin Telegram Movie Wizard", `Interaktiv kino saqlandi: ${newMovie.title}`);
        delete adminActiveStates[userId];
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "admin_confirm_save_serial") {
        const session = adminActiveStates[userId];
        if (!session || session.action !== "adding_serial" || !session.data) {
          await bot.answerCallbackQuery(query.id, { text: "Seans topilmadi!", show_alert: true });
          return;
        }
        const sData = session.data;
        const newSerial = {
          id: db.serials.length > 0 ? Math.max(...db.serials.map((s: any) => s.id), 0) + 1 : 5001,
          codes: sData.codes,
          title: sData.title,
          description: sData.description,
          genre: sData.genre,
          year: sData.year,
          rating: sData.rating,
          poster_url: sData.poster,
          trailer_url: sData.trailer,
          seasons: [{
            season_num: sData.episode.season_num,
            episodes: [{
              episode_num: sData.episode.episode_num,
              title: sData.episode.title,
              file_id: sData.episode.file_id
            }]
          }],
          views: 0,
          likes: 0,
          dislikes: 0
        };

        db.serials.push(newSerial);
        saveDb();

        await bot.sendMessage(query.message!.chat.id, `✅ *Serial muvaffaqiyatli saqlandi!* \n\n• Serial: *${newSerial.title}*`);
        delete adminActiveStates[userId];
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "admin_confirm_save_channel") {
        const session = adminActiveStates[userId];
        if (!session || session.action !== "adding_channel" || !session.data) {
          await bot.answerCallbackQuery(query.id, { text: "Seans vujudga kelmadi!", show_alert: true });
          return;
        }
        const cData = session.data;
        const newChan = {
          id: Math.random().toString().slice(2, 9),
          name: cData.name,
          url: cData.url,
          telegram_id: cData.telegram_id,
          type: cData.type
        };

        db.channels.push(newChan);
        saveDb();

        await bot.sendMessage(query.message!.chat.id, `✅ *Majburiy hamkorlik kanali qo'shildi!* \n\n• Kanal: *${newChan.name}*`);
        delete adminActiveStates[userId];
        await bot.answerCallbackQuery(query.id);
        return;
      }
    }

    // GENERAL USER INTERACTIVE BUTTON CALLBACK TRIGGERS
    if (data === "check_channels_join") {
      const check = await checkAllSubscriptions(userId);
      if (check.success) {
        await bot.answerCallbackQuery(query.id, { text: "Barcha obunalar tekshirildi va tasdiqlandi!" });
        await bot.deleteMessage(query.message!.chat.id, query.message!.message_id).catch(() => {});
        await bot.sendMessage(query.message!.chat.id, "🎉 *Ajoyib! Kanallarga obuna bo'lganingiz tasdiqlandi.*\nMenyudan istalgan bo'limni tanlashingiz mumkin.", { reply_markup: getMainMenu(userId) });
      } else {
        let alertText = "❌ Hali hamma kanallarga a'zo emassiz:\n";
        check.unsubscribed.forEach((c) => alertText += `• ${c.name}\n`);
        await bot.answerCallbackQuery(query.id, { text: alertText, show_alert: true });
      }
      return;
    }

    if (data.startsWith("like_") || data.startsWith("dislike_")) {
      const isLike = data.startsWith("like_");
      const parts = data.split("_");
      const subType = parts[1];
      const id = Number(parts[2]);

      const existVote = db.votes.find(v => v.user_id === userId && v.movie_id === id && v.is_serial === (subType === "serial"));
      if (existVote) {
        if (existVote.type === (isLike ? "like" : "dislike")) {
          await bot.answerCallbackQuery(query.id, { text: "Siz allaqachon munosabat bildirgansiz." });
          return;
        }
        existVote.type = isLike ? "like" : "dislike";
        if (subType === "movie") {
          const m = db.movies.find(x => x.id === id);
          if (m) {
            if (isLike) { m.likes += 1; m.dislikes = Math.max(0, m.dislikes - 1); }
            else { m.dislikes += 1; m.likes = Math.max(0, m.likes - 1); }
          }
        } else {
          const s = db.serials.find(x => x.id === id);
          if (s) {
            if (isLike) { s.likes += 1; s.dislikes = Math.max(0, s.dislikes - 1); }
            else { s.dislikes += 1; s.likes = Math.max(0, s.likes - 1); }
          }
        }
        saveDb();
        await bot.answerCallbackQuery(query.id, { text: "Munosabatingiz yangilandi!" });
      } else {
        db.votes.push({ user_id: userId, movie_id: id, is_serial: (subType === "serial"), type: isLike ? "like" : "dislike" });
        if (subType === "movie") {
          const m = db.movies.find(x => x.id === id);
          if (m) { if (isLike) m.likes += 1; else m.dislikes += 1; }
        } else {
          const s = db.serials.find(x => x.id === id);
          if (s) { if (isLike) s.likes += 1; else s.dislikes += 1; }
        }
        saveDb();
        await bot.answerCallbackQuery(query.id, { text: "Ovoz berganingiz uchun rahmat!" });
      }

      // Re-edit voting feedback markups dynamically
      try {
        await bot.editMessageReplyMarkup({
          inline_keyboard: query.message!.reply_markup!.inline_keyboard.map((row) => {
            return row.map((btn) => {
              if (btn.callback_data === data) {
                return { ...btn, text: btn.text + " ✅" };
              }
              return btn;
            });
          })
        }, { chat_id: query.message!.chat.id, message_id: query.message!.message_id });
      } catch (e) {}
      return;
    }

    if (data.startsWith("fav_")) {
      const parts = data.split("_");
      const isSerial = parts[1] === "serial";
      const id = Number(parts[2]);

      const existFav = db.votes.find(v => v.user_id === userId && v.movie_id === id && v.is_serial === isSerial && v.type === "fav");
      if (existFav) {
        db.votes = db.votes.filter(v => !(v.user_id === userId && v.movie_id === id && v.is_serial === isSerial && v.type === "fav"));
        saveDb();
        await bot.answerCallbackQuery(query.id, { text: "Sevimlilardan o'chirildi." });
        try {
          await bot.editMessageReplyMarkup({
            inline_keyboard: query.message!.reply_markup!.inline_keyboard.map((row) => {
              return row.map((btn) => {
                if (btn.callback_data === data) { return { text: "❤️ Sevimlilarga qo'shish", callback_data: data }; }
                return btn;
              });
            })
          }, { chat_id: query.message!.chat.id, message_id: query.message!.message_id });
        } catch (e) {}
      } else {
        db.votes.push({ user_id: userId, movie_id: id, is_serial: isSerial, type: "fav" });
        saveDb();
        await bot.answerCallbackQuery(query.id, { text: "Sevimlilar ro'yxatiga qo'shildi!" });
        try {
          await bot.editMessageReplyMarkup({
            inline_keyboard: query.message!.reply_markup!.inline_keyboard.map((row) => {
              return row.map((btn) => {
                if (btn.callback_data === data) { return { text: "💚 Sevimlilardan o'chirish", callback_data: data }; }
                return btn;
              });
            })
          }, { chat_id: query.message!.chat.id, message_id: query.message!.message_id });
        } catch (e) {}
      }
      return;
    }

    if (data.startsWith("genre_")) {
      const selectedGenre = data.replace("genre_", "");
      const movies = db.movies.filter(m => m.genre && m.genre.toLowerCase() === selectedGenre.toLowerCase());
      const serials = db.serials.filter(s => s.genre && s.genre.toLowerCase() === selectedGenre.toLowerCase());

      if (movies.length === 0 && serials.length === 0) {
        await bot.sendMessage(query.message!.chat.id, `📚 *${selectedGenre}* janrida kontent topilmadi.`, { parse_mode: "Markdown" });
      } else {
        let listText = `📚 *${selectedGenre.toUpperCase()}* janridagi barcha kinolar:\n\n`;
        movies.forEach((m) => { listText += `🎬 *${m.title}* (Kodi: \`${m.codes[0]}\`)\n`; });
        if (serials.length > 0) {
          listText += `\n📺 *Seriallar:*\n`;
          serials.forEach((s) => { listText += `📺 *${s.title}* (Kodi: \`${s.codes[0]}\`)\n`; });
        }
        await bot.sendMessage(query.message!.chat.id, listText, { parse_mode: "Markdown" });
      }
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith("dl_movie_")) {
      const parts = data.split("_");
      const movieId = Number(parts[2]);
      const quality = parts.slice(3).join("_").replace(/_/g, " ");

      const m = db.movies.find(x => x.id === movieId);
      if (m) {
        let fileId = (m.video_quality_urls as any)[quality];
        if (!fileId) {
          const keys = Object.keys(m.video_quality_urls || {});
          if (keys.length > 0) fileId = (m.video_quality_urls as any)[keys[0]];
        }

        if (fileId) {
          m.downloads += 1;
          saveDb();
          await bot.answerCallbackQuery(query.id);

          const infoMsg = await bot.sendMessage(
            query.message!.chat.id,
            `📥 *"${m.title}"* kinosi yuklanmoqda...\nSifat: *${quality}*\n\n_Iltimos, video yuklanishini kuting..._`,
            { parse_mode: "Markdown" }
          );

          await bot.sendVideo(query.message!.chat.id, fileId, {
            caption: `🎬 *${m.title}*\n\n⭐ Reyting: ${m.rating}\n📅 Yil: ${m.year}\n\n🤖 @${botUsername} orqali yuklab olindi.`,
            parse_mode: "Markdown"
          }).then(() => {
            bot?.deleteMessage(query.message!.chat.id, infoMsg.message_id).catch(() => {});
          }).catch(async () => {
            await bot.sendDocument(query.message!.chat.id, fileId, {
              caption: `🎬 *${m.title}*\n🤖 @${botUsername} orqali yuklab olindi.`,
              parse_mode: "Markdown"
            }).then(() => {
              bot?.deleteMessage(query.message!.chat.id, infoMsg.message_id).catch(() => {});
            }).catch(async () => {
              await bot?.deleteMessage(query.message!.chat.id, infoMsg.message_id).catch(() => {});
              await bot?.sendMessage(
                query.message!.chat.id,
                `❌ *Kino faylini to'g'ridan to'g'ri jo'natib bo'lmadi!*\n\nAgar bu video havolasi bo'lsa, uni brauzerdan ko'ring:\n🌐 ${fileId}`,
                { parse_mode: "Markdown" }
              );
            });
          });
        } else {
          await bot.answerCallbackQuery(query.id, { text: "Fayl topilmadi!", show_alert: true });
        }
      }
      return;
    }

    if (data.startsWith("serial_ep_")) {
      const parts = data.split("_");
      const serialId = Number(parts[2]);
      const seasonNum = Number(parts[3]);
      const epNum = Number(parts[4]);

      const serial = db.serials.find(s => s.id === serialId);
      if (serial) {
        const season = serial.seasons.find(s => s.season_num === seasonNum);
        const ep = season?.episodes.find(e => e.episode_num === epNum);
        if (ep) {
          serial.views += 1;
          saveDb();

          await bot.sendMessage(
            query.message!.chat.id,
            `📺 *${serial.title}* — ${seasonNum}-Fasl, ${epNum}-Qism\n\nNomi: _${ep.title || "Nomsiz"}_`,
            { parse_mode: "Markdown" }
          );

          if (ep.file_id) {
            await bot.sendVideo(query.message!.chat.id, ep.file_id, {
              caption: `🎬 ${serial.title} S${seasonNum}E${epNum}`
            }).catch(async () => {
              await bot?.sendMessage(
                query.message!.chat.id,
                `🔗 *Kino Video Havolasi:* ${ep.file_id}\n\n_Server yukini orttirmaslik uchun uni brauzerda oching._`,
                { parse_mode: "Markdown" }
              );
            });
          }
        }
      }
      await bot.answerCallbackQuery(query.id);
      return;
    }
  });
}

async function handleSearch(chatId: number, userId: string, text: string) {
  const db = loadDb();

  db.history.unshift({
    id: Math.random().toString().slice(2, 9),
    user_id: userId,
    query: text,
    timestamp: new Date().toISOString()
  });
  if (db.history.length > 500) { db.history = db.history.slice(0, 500); }
  saveDb();

  let m = db.movies.find(x => x.codes.some(c => c.toLowerCase() === text.toLowerCase()));
  if (m) {
    await showMovieCard(chatId, userId, m);
    return;
  }

  let s = db.serials.find(x => x.codes.some(c => c.toLowerCase() === text.toLowerCase()));
  if (s) {
    await showSerialCard(chatId, userId, s);
    return;
  }

  const matchesMovies = db.movies.filter(x => x.title.toLowerCase().includes(text.toLowerCase()));
  const matchesSerials = db.serials.filter(x => x.title.toLowerCase().includes(text.toLowerCase()));

  if (matchesMovies.length === 1 && matchesSerials.length === 0) {
    await showMovieCard(chatId, userId, matchesMovies[0]);
    return;
  }
  if (matchesSerials.length === 1 && matchesMovies.length === 0) {
    await showSerialCard(chatId, userId, matchesSerials[0]);
    return;
  }

  if (matchesMovies.length > 0 || matchesSerials.length > 0) {
    let responseText = `🔍 *"${text}"* bo'yicha topilgan natijalar:\n\n`;
    matchesMovies.forEach((item) => {
      responseText += `🎬 *${item.title}* (Kod: \`${item.codes[0]}\`)\n`;
    });
    matchesSerials.forEach((item) => {
      responseText += `📺 *${item.title}* (Kod: \`${item.codes[0]}\`)\n`;
    });
    responseText += `\n_Ko'rish uchun kino kodini kiritib yuboring!_`;
    await bot?.sendMessage(chatId, responseText, { parse_mode: "Markdown" });
    return;
  }

  if (!isNaN(Number(text))) {
    await bot?.sendMessage(chatId, "❌ *Ushbu kodli kino topilmadi!*\nNomini yozib qidirishga harakat qiling yoki yordam bo'limidan adminlarimizdan so'rang.", { parse_mode: "Markdown" });
  } else {
    await bot?.sendMessage(chatId, `❌ *"${text}" bo'yicha kontent topilmadi!*\nBoshqa kalit so'z yozing yoki unikal kodini kiriting.`, { parse_mode: "Markdown" });
  }
}

async function showMovieCard(chatId: number, userId: string, movie: Movie) {
  if (!bot) return;
  const db = loadDb();
  movie.views += 1;
  saveDb();

  let caption = `🎬 *${movie.title}*\n\n`;
  caption += `📅 *Yil:* ${movie.year} | 🌐 *Janr:* ${movie.genre}\n`;
  caption += `⭐ *Reyting:* ${movie.rating}/10\n\n`;
  caption += `📖 *Tafsilot:* ${movie.description || "Syujet yozilmagan."}\n\n`;
  caption += `🔑 *Kino kodlari:* ${movie.codes.map(c => `\`${c}\``).join(", ")}\n`;
  caption += `👁 *Ko'rishlar:* ${movie.views} | 📥 *Yuklashlar:* ${movie.downloads}\n\n`;

  const isFavorite = db.votes.some(v => v.user_id === userId && v.movie_id === movie.id && v.is_serial === false && v.type === "fav");

  const inline: any[] = [];
  inline.push([
    { text: `👍 ${movie.likes || 0}`, callback_data: `like_movie_${movie.id}` },
    { text: `👎 ${movie.dislikes || 0}`, callback_data: `dislike_movie_${movie.id}` }
  ]);

  const qualitiesRow: any[] = [];
  Object.keys(movie.video_quality_urls || {}).forEach((quality) => {
    const fileId = (movie.video_quality_urls as any)[quality];
    if (fileId) {
      const trimmedFileId = fileId.trim();
      if (trimmedFileId.startsWith("http") || trimmedFileId.startsWith("t.me")) {
        qualitiesRow.push({ text: `📥 Yuklash (${quality})`, url: trimmedFileId });
      } else {
        const cleanQuality = quality.replace(/ /g, "_");
        qualitiesRow.push({ text: `📥 Yuklash (${quality})`, callback_data: `dl_movie_${movie.id}_${cleanQuality}` });
      }
    }
  });
  if (qualitiesRow.length > 0) inline.push(qualitiesRow);

  const trajRow: any[] = [];
  if (movie.trailer_url) trajRow.push({ text: "🎬 Trailer ko'rish", url: movie.trailer_url });
  trajRow.push({ text: isFavorite ? "💚 Sevimlilardan o'chirish" : "❤️ Sevimlilarga qo'shish", callback_data: `fav_movie_${movie.id}` });
  inline.push(trajRow);

  if (movie.poster_url && movie.poster_url.trim().startsWith("http")) {
    await bot.sendPhoto(chatId, movie.poster_url, {
      caption,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: inline }
    }).catch(async () => {
      await bot?.sendMessage(chatId, caption, { parse_mode: "Markdown", reply_markup: { inline_keyboard: inline } });
    });
  } else {
    await bot.sendMessage(chatId, caption, { parse_mode: "Markdown", reply_markup: { inline_keyboard: inline } });
  }

  movie.downloads += 1;
  saveDb();
}

async function showSerialCard(chatId: number, userId: string, serial: Serial) {
  if (!bot) return;
  const db = loadDb();

  let caption = `📺 *SERIAL:* *${serial.title}*\n\n`;
  caption += `📅 *Yil:* ${serial.year} | 🌐 *Janr:* ${serial.genre}\n`;
  caption += `⭐ *Reyting:* ${serial.rating}/10\n\n`;
  caption += `📖 *Tafsilot:* ${serial.description || "Tavsifsiz."}\n\n`;
  caption += `🔑 *Serial kodi:* \`${serial.codes[0]}\`\n`;
  caption += `👁 *Ko'rishlar:* ${serial.views || 0}\n\n`;

  const isFavorite = db.votes.some(v => v.user_id === userId && v.movie_id === serial.id && v.is_serial === true && v.type === "fav");

  const inline: any[] = [];
  inline.push([
    { text: `👍 ${serial.likes || 0}`, callback_data: `like_serial_${serial.id}` },
    { text: `👎 ${serial.dislikes || 0}`, callback_data: `dislike_serial_${serial.id}` }
  ]);

  inline.push([{ text: isFavorite ? "💚 Sevimlilardan o'chirish" : "❤️ Sevimlilarga qo'shish", callback_data: `fav_serial_${serial.id}` }]);
  if (serial.trailer_url) inline.push([{ text: "🎬 Trailer ko'rish", url: serial.trailer_url }]);

  serial.seasons.forEach((season) => {
    const row: any[] = [];
    season.episodes.forEach((ep) => {
      row.push({ text: `F${season.season_num} Q${ep.episode_num}`, callback_data: `serial_ep_${serial.id}_${season.season_num}_${ep.episode_num}` });
    });
    for (let i = 0; i < row.length; i += 4) {
      inline.push(row.slice(i, i + 4));
    }
  });

  if (serial.poster_url && serial.poster_url.trim().startsWith("http")) {
    await bot.sendPhoto(chatId, serial.poster_url, {
      caption,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: inline }
    }).catch(async () => {
      await bot?.sendMessage(chatId, caption, { parse_mode: "Markdown", reply_markup: { inline_keyboard: inline } });
    });
  } else {
    await bot.sendMessage(chatId, caption, { parse_mode: "Markdown", reply_markup: { inline_keyboard: inline } });
  }
}

async function showNewMovies(chatId: number) {
  const db = loadDb();
  const sorted = [...db.movies].sort((a,b) => b.id - a.id).slice(0, 10);
  if (sorted.length === 0) {
    await bot?.sendMessage(chatId, "🎬 Yangi kinolar hozircha mavjud emas.");
    return;
  }
  let txt = "🎬 *ENG YANGI KINOLAR:* \n\n";
  sorted.forEach((item, idx) => {
    txt += `${idx + 1}. *${item.title}* — Kod: \`${item.codes[0]}\` | ⭐ ${item.rating}/10\n`;
  });
  txt += "\n_Ko'rish uchun kino kodini yozib yuboring!_";
  await bot?.sendMessage(chatId, txt, { parse_mode: "Markdown" });
}

async function showTopMovies(chatId: number) {
  const db = loadDb();
  const sorted = [...db.movies].sort((a,b) => b.views - a.views).slice(0, 10);
  if (sorted.length === 0) {
    await bot?.sendMessage(chatId, "🏆 Top kinolar hali shakllanmagan.");
    return;
  }
  let txt = "🏆 *ENG KO'P KO'RILGAN TOP KINOLAR:* \n\n";
  sorted.forEach((item, idx) => {
    txt += `${idx + 1}. *${item.title}* — Kod: \`${item.codes[0]}\` | 👁 \`${item.views}\` marta ko'rilgan\n`;
  });
  txt += "\n_Ko'rish uchun kino kodini kiritib yuboring!_";
  await bot?.sendMessage(chatId, txt, { parse_mode: "Markdown" });
}

async function showRandomMovie(chatId: number, userId: string) {
  const db = loadDb();
  if (db.movies.length === 0) {
    await bot?.sendMessage(chatId, "🎲 Kinolar bazasi hali bo'sh!");
    return;
  }
  const rand = db.movies[Math.floor(Math.random() * db.movies.length)];
  await bot?.sendMessage(chatId, "🎲 *Tasodifiy tanlangan kino:*");
  await showMovieCard(chatId, userId, rand);
}

async function showGenresList(chatId: number) {
  const db = loadDb();
  const genresSet = new Set<string>();
  db.movies.forEach(m => { if (m.genre) genresSet.add(m.genre) });
  db.serials.forEach(s => { if (s.genre) genresSet.add(s.genre) });
  ["Jangari", "Komediya", "Drama", "Fantastika", "Qo'rqinchli", "Triller", "Tarixiy", "Romantik"].forEach(g => genresSet.add(g));

  const list = Array.from(genresSet);
  const inline: any[] = [];
  const row: any[] = [];
  list.forEach((g) => { row.push({ text: g, callback_data: `genre_${g}` }); });
  for (let i = 0; i < row.length; i += 2) { inline.push(row.slice(i, i + 2)); }

  await bot?.sendMessage(chatId, "📚 *Kino va Serial Janrlari:*\n\nJanrni tanlang:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: inline }
  });
}

async function showSerialsList(chatId: number) {
  const db = loadDb();
  if (db.serials.length === 0) {
    await bot?.sendMessage(chatId, "📺 Seriallar hozircha qo'shilmagan.");
    return;
  }
  let txt = "📺 *MAVJUD TV-SERIALLAR RO'YXATI:*\n\n";
  db.serials.forEach((item) => {
    txt += `• *${item.title}* (Kod: \`${item.codes[0]}\`) | Fasllar: ${item.seasons.length} ta\n`;
  });
  txt += "\n_Serialni ko'rish uchun uning maxsus kodini kiriting!_";
  await bot?.sendMessage(chatId, txt, { parse_mode: "Markdown" });
}

async function showFavorites(chatId: number, userId: string) {
  const db = loadDb();
  const favVotes = db.votes.filter(v => v.user_id === userId && v.type === "fav");
  if (favVotes.length === 0) {
    await bot?.sendMessage(chatId, "❤️ *Sizning sevimlilar ro'yxatingiz bo'sh.* Kinolardagi '❤️' ramzini bosish orqali qo'shing.");
    return;
  }

  let text = "❤️ *SIZNING SEVIMLI KINO VA SERIALLARINGIZ:* \n\n";
  favVotes.forEach((fv, idx) => {
    if (fv.is_serial) {
      const s = db.serials.find(x => x.id === fv.movie_id);
      if (s) text += `${idx + 1}. 📺 *[Serial]* *${s.title}* — Kod: \`${s.codes[0]}\`\n`;
    } else {
      const m = db.movies.find(x => x.id === fv.movie_id);
      if (m) text += `${idx + 1}. 🎬 *[Kino]* *${m.title}* — Kod: \`${m.codes[0]}\`\n`;
    }
  });
  await bot?.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

async function showProfile(chatId: number, userId: string) {
  const db = loadDb();
  const user = db.users[userId];
  if (!user) return;

  const regDate = new Date(user.joined_at).toLocaleDateString("UZ-uz");

  let text = "👤 *FOYDALANUVChI PROFILI:*\n\n";
  text += `🆔 *Telegram ID:* \`${user.id}\`\n`;
  text += `👤 *Ism:* ${user.first_name || "Mavjud emas"}\n`;
  text += `🔗 *Username:* @${user.username || "yo'q"}\n`;
  text += `📅 *Sana:* ${regDate}\n`;
  text += `👥 *Taklif etgan referallaringiz:* *${user.referrals_count}* ta\n`;
  text += `🌟 *Premium:* ${user.is_premium ? "💎 *VIP PREMIUM FAOL*" : "🔴 Yo'q"}\n\n`;

  if (user.is_premium) {
    text += "👑 *Siz VIP Premium foydalanuvchisiz!* Barcha reklama va a'zolik majburiyatlaridan ozodsiz!";
  } else {
    text += "💎 *VIP PREMIUM imkoniyatlari:*\n";
    text += "1. Kanallarga a'zo bo'lish majburiyati olib tashlanadi.\n";
    text += "2. Reklama va cheklovlar butkul o'chiriladi.\n\n";
    text += "🎁 *QANDAY QILIB PREMIUM OLISH MUMKIN?*\n";
    text += "👉 *1-Yo'l:* `10 ta do'stni` referal havola orqali botga taklif qiling.\n";
    text += "👉 *2-Yo'l:* Atigi *15 000 so'm / oy* to'lov qiling.\n\n";
    text += "_Plastik karta: `5614682119199406` (O/Turamirzayev)_";
  }

  await bot?.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

async function showReferral(chatId: number, userId: string) {
  const db = loadDb();
  const user = db.users[userId];
  if (!user) return;

  const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  let text = "🎁 *HAMKORLIK VA REFERAL TIZIMI:*\n\n";
  text += `🔗 *Taklif havolangiz:*\n${refLink}\n\n`;
  text += `📊 *Referal holat:* *${user.referrals_count}* ta taklif yig'ilgan (Premiumgacha kamida *${Math.max(0, 10 - user.referrals_count)}* ta a'zo qoldi!)\n\n`;
  text += "💡 *Qo'llanma:* Havolani do'stlaringizga tarqating. Do'stingiz botga kirib a'zolikni qabul qilsa, sizga +1 referal hisoblanadi.";

  await bot?.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Do'stlarga ulashish", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Istalgan kino va serialni topuvchi eng zo'r kino bot!")}` }]
      ]
    }
  });
}

async function showHistory(chatId: number, userId: string) {
  const db = loadDb();
  const hist = db.history.filter(h => h.user_id === userId).slice(0, 10);
  if (hist.length === 0) {
    await bot?.sendMessage(chatId, "📜 Qidiruv tarixi hali shakllanmagan.");
    return;
  }

  let text = "📜 *OXIRGI QIDIRUVLARINGIZ:* \n\n";
  hist.forEach((h, idx) => {
    const dateStr = new Date(h.timestamp).toLocaleTimeString("UZ-uz", { hour: "numeric", minute: "numeric" });
    text += `${idx + 1}. *"${h.query}"* — _${dateStr}_\n`;
  });
  await bot?.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

// ==========================================
// 💻 BACKEND API ENDPOINTS & EXPRESS WEBSERVER
// ==========================================
const app = express();
app.use(express.json());

// Init Telegram Bot
initBot(BOT_TOKEN);

app.post("/api/telegram/webhook", (req, res) => {
  const activeBot = getBot();
  if (activeBot) {
    try {
      activeBot.processUpdate(req.body);
    } catch (err: any) {
      console.error("Webhook processing error:", err.message);
    }
  }
  res.sendStatus(200);
});

app.post("/api/auth/login", (req, res) => {
  const { admin_id } = req.body;
  if (!admin_id) return res.status(400).json({ error: "Telegram ID kiritilmadi" });

  const currentDb = loadDb();
  const isAdmin = currentDb.admins.includes(String(admin_id));
  if (!isAdmin) return res.status(403).json({ error: "Siz admin emassiz" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  currentDb.sessions[admin_id] = { admin_id: String(admin_id), login_time: new Date().toISOString(), login_code: code };
  saveDbImmediately();

  const activeBot = getBot();
  if (activeBot) {
    activeBot.sendMessage(Number(admin_id), `🔑 *KINO PANELGA KIRISh KODI:* \n\nKod: \`${code}\``, { parse_mode: "Markdown" })
      .then(() => res.json({ success: true }))
      .catch(() => res.json({ success: true, dev_code: code }));
  } else {
    res.json({ success: true, dev_code: code });
  }
});

app.post("/api/auth/verify", (req, res) => {
  const { admin_id, code } = req.body;
  if (!admin_id || !code) return res.status(400).json({ error: "Ma'lumot to'liq emas" });

  const currentDb = loadDb();
  const session = currentDb.sessions[admin_id];
  if (!session || session.login_code !== String(code)) {
    return res.status(401).json({ error: "Kod xato kiritildi" });
  }

  delete session.login_code;
  saveDb();
  res.json({ success: true, token: `session_token_${admin_id}_verified`, admin_id });
});

app.get("/api/auth/verify-telegram-admin", (req, res) => {
  const { admin_id } = req.query;
  if (!admin_id) return res.status(400).json({ error: "ID kiritilmagan" });

  const currentDb = loadDb();
  const isAdmin = currentDb.admins.includes(String(admin_id));
  if (!isAdmin) return res.status(403).json({ error: "Ruxsat yo'q" });

  const token = `session_token_${admin_id}_quick`;
  currentDb.sessions[String(admin_id)] = { admin_id: String(admin_id), login_time: new Date().toISOString() };
  saveDbImmediately();
  res.json({ success: true, token, admin_id });
});

app.get("/api/stats", (req, res) => {
  const currentDb = loadDb();
  const users = Object.values(currentDb.users);
  let todayUsers = 0;
  const startOfToday = new Date().setHours(0,0,0,0);

  users.forEach((u) => {
    if (new Date(u.joined_at).getTime() >= startOfToday) todayUsers++;
  });

  res.json({
    totalUsers: users.length,
    todayUsers,
    totalMovies: currentDb.movies.length,
    totalSerials: currentDb.serials.length,
    totalChannels: currentDb.channels.length,
    openSupports: currentDb.support.filter(s => s.status !== "Yopilgan").length,
    pendingRequests: currentDb.requests.filter(r => r.status === "Kutilmoqda").length,
    bot_status: getBotStatus()
  });
});

app.get("/api/movies", (req, res) => {
  res.json(loadDb().movies);
});

app.post("/api/movies", (req, res) => {
  const { title, description, genre, year, rating, video_quality_urls, poster_url, trailer_url, codes, adminId } = req.body;
  if (!title) return res.status(400).json({ error: "Nom kiritilmadi" });

  const currentDb = loadDb();
  let finalCodes = codes || [];
  if (finalCodes.length === 0 || finalCodes[0].trim() === "") {
    let max = 1000;
    currentDb.movies.forEach(m => m.codes.forEach(c => { if (!isNaN(Number(c)) && Number(c) > max) max = Number(c); }));
    finalCodes = [String(max + 1)];
  }

  const newMovie: Movie = {
    id: Date.now(),
    title,
    description: description || "",
    genre: genre || "Jangari",
    year: Number(year) || new Date().getFullYear(),
    rating: Number(rating) || 7.5,
    video_quality_urls: video_quality_urls || {},
    poster_url: poster_url || "",
    trailer_url: trailer_url || "",
    views: 0,
    downloads: 0,
    likes: 0,
    dislikes: 0,
    codes: finalCodes.map((c: string) => c.trim().toUpperCase())
  };

  currentDb.movies.push(newMovie);
  saveDb();
  addLog("Kino Qo'shildi", `Kino "${title}" kiritildi`, String(adminId));
  res.json({ success: true, movie: newMovie });
});

app.put("/api/movies/:id", (req, res) => {
  const id = Number(req.params.id);
  const currentDb = loadDb();
  const mIndex = currentDb.movies.findIndex(x => x.id === id);
  if (mIndex === -1) return res.status(404).json({ error: "Topilmadi" });

  currentDb.movies[mIndex] = { ...currentDb.movies[mIndex], ...req.body };
  saveDb();
  res.json({ success: true, movie: currentDb.movies[mIndex] });
});

app.delete("/api/movies/:id", (req, res) => {
  const id = Number(req.params.id);
  const currentDb = loadDb();
  const idx = currentDb.movies.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: "Topilmadi" });

  currentDb.movies.splice(idx, 1);
  saveDb();
  res.json({ success: true });
});

app.get("/api/serials", (req, res) => {
  res.json(loadDb().serials);
});

app.get("/api/channels", (req, res) => {
  res.json(loadDb().channels);
});

app.post("/api/channels", (req, res) => {
  const { name, url, telegram_id, type, adminId } = req.body;
  const currentDb = loadDb();
  const newChan = { id: Date.now().toString(), name, url, telegram_id, type };
  currentDb.channels.push(newChan);
  saveDb();
  addLog("Hamkor kanal qo'shildi", `Nom: ${name}`, String(adminId));
  res.json({ success: true, channel: newChan });
});

app.delete("/api/channels/:id", (req, res) => {
  const currentDb = loadDb();
  const idx = currentDb.channels.findIndex(c => c.id === req.params.id);
  if (idx !== -1) {
    currentDb.channels.splice(idx, 1);
    saveDb();
  }
  res.json({ success: true });
});

app.get("/api/support", (req, res) => {
  res.json(loadDb().support);
});

app.post("/api/support/reply", (req, res) => {
  const { ticketId, text, adminId } = req.body;
  const currentDb = loadDb();
  const ticket = currentDb.support.find(t => t.id === ticketId);
  if (!ticket) return res.status(404).json({ error: "Topilmadi" });

  ticket.messages.push({ sender: "admin", text, timestamp: new Date().toISOString() });
  ticket.status = "Ochiq";
  saveDb();

  const activeBot = getBot();
  if (activeBot) {
    activeBot.sendMessage(Number(ticket.user_id), `💬 *Admin Javobi:* \n\n${text}`, { parse_mode: "Markdown" }).catch(() => {});
  }
  res.json({ success: true, ticket });
});

app.get("/api/requests", (req, res) => {
  res.json(loadDb().requests);
});

app.post("/api/requests/resolve", (req, res) => {
  const { requestId, status, admin_notes, adminId } = req.body;
  const currentDb = loadDb();
  const reqItem = currentDb.requests.find(r => r.id === requestId);
  if (!reqItem) return res.status(404).json({ error: "Topilmadi" });

  reqItem.status = status;
  reqItem.admin_notes = admin_notes || "";
  saveDb();

  const activeBot = getBot();
  if (activeBot) {
    const emj = status === "Bajarildi" ? "🟢 BAJARILDI" : "🔴 RAD ETILDI";
    activeBot.sendMessage(Number(reqItem.user_id), `📣 *Siz so'ragan kino bo'yicha javob:* \n\nKino: *${reqItem.movie_title}*\nHolati: ${emj}\nIzoh: ${admin_notes || "Yo'q"}`).catch(() => {});
  }
  res.json({ success: true, request: reqItem });
});

app.post("/api/broadcast", async (req, res) => {
  const { text, image_url, adminId } = req.body;
  res.json({ success: true, message: "Reklama tarqatila boshlandi!" });

  const currentDb = loadDb();
  const users = Object.values(currentDb.users);
  const activeBot = getBot();
  if (!activeBot || users.length === 0) return;

  for (const u of users) {
    try {
      if (image_url) {
        await activeBot.sendPhoto(Number(u.id), image_url, { caption: text, parse_mode: "Markdown" });
      } else {
        await activeBot.sendMessage(Number(u.id), text, { parse_mode: "Markdown" });
      }
    } catch {}
    await new Promise(r => setTimeout(r, 40));
  }
  addLog("Yig'ma reklama tarqatildi", `reklama tugadi`, String(adminId));
});

app.get("/api/settings", (req, res) => {
  res.json(loadDb().settings);
});

app.post("/api/settings", (req, res) => {
  const currentDb = loadDb();
  currentDb.settings = { ...currentDb.settings, ...req.body };
  saveDb();
  res.json({ success: true, settings: currentDb.settings });
});

app.get("/api/users", (req, res) => {
  res.json(Object.values(loadDb().users));
});

app.post("/api/users/ban", (req, res) => {
  const { userId } = req.body;
  const currentDb = loadDb();
  if (currentDb.users[userId]) {
    currentDb.users[userId].is_banned = true;
    saveDb();
  }
  res.json({ success: true });
});

app.post("/api/users/unban", (req, res) => {
  const { userId } = req.body;
  const currentDb = loadDb();
  if (currentDb.users[userId]) {
    currentDb.users[userId].is_banned = false;
    saveDb();
  }
  res.json({ success: true });
});

app.post("/api/users/premium", (req, res) => {
  const { userId, is_premium } = req.body;
  const currentDb = loadDb();
  if (currentDb.users[userId]) {
    currentDb.users[userId].is_premium = is_premium;
    saveDb();
  }
  res.json({ success: true });
});

app.get("/api/admins", (req, res) => {
  res.json(loadDb().admins);
});

app.post("/api/admins", (req, res) => {
  const { newAdminId } = req.body;
  const currentDb = loadDb();
  if (!currentDb.admins.includes(String(newAdminId))) {
    currentDb.admins.push(String(newAdminId));
    saveDb();
  }
  res.json({ success: true, admins: currentDb.admins });
});

app.delete("/api/admins/:targetId", (req, res) => {
  const currentDb = loadDb();
  if (req.params.targetId !== SUPER_ADMIN_ID) {
    currentDb.admins = currentDb.admins.filter(x => x !== req.params.targetId);
    saveDb();
  }
  res.json({ success: true, admins: currentDb.admins });
});

app.get("/api/logs", (req, res) => {
  res.json(loadDb().logs);
});

// Start Web & API Server
async function startWebBackend() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pristine Single-File Server running on http://localhost:${PORT}`);
  });
}

startWebBackend();
