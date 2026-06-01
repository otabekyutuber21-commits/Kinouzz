import TelegramBot from "node-telegram-bot-api";
import { 
  loadDb, 
  saveDb, 
  addLog, 
  User, 
  Movie, 
  Serial, 
  SupportTicket, 
  MovieRequest, 
  MandatoryChannel,
  Vote
} from "./db";

let bot: TelegramBot | null = null;
export let botInitError: string | null = null;
export let isBotPolling = false;
export let botUsername = "ultrakinolarbot";

// Anti-flood state
const userLastMessageTime: Record<string, number> = {};
const FLOOD_LIMIT_MS = 1000; // 1 message per second limit

// Store active navigation state for users (support or request modes)
const userActiveState: Record<string, "idle" | "support" | "request"> = {};

// Store active admin session states for wizards and broadcast flow
interface AdminSession {
  action: "waiting_broadcast" | "adding_movie" | "adding_serial" | "adding_channel";
  step: number;
  data: any;
}
const adminActiveStates: Record<string, AdminSession> = {};

export function getBotStatus() {
  if (botInitError) return `XATO: ${botInitError}`;
  if (isBotPolling) return "FAOL (Polling)";
  return "FAOLIYASIZ";
}

export function initBot(token: string) {
  if (!token || token.trim() === "" || token.includes("MY_GEMINI_API_KEY")) {
    botInitError = "Telegram token kiritilmagan yoki noto'g'ri.";
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
        console.warn("APP_URL not set or invalid, resorting to polling for safety.");
        bot = new TelegramBot(token, { polling: true });
        isBotPolling = true;
      }
    } else {
      console.log("Starting Telegram Bot in POLLING mode (development)...");
      bot = new TelegramBot(token, { polling: true });
      isBotPolling = true;
      botInitError = null;
    }

    bot.on("polling_error", (error: any) => {
      console.error("Telegram Polling Error:", error.message || error);
      botInitError = error.message || String(error);
      addLog("Bot Polling Xatosi", `Polling xatosi: ${error.message || error}`);
    });

    bot.on("webhook_error", (error: any) => {
      console.error("Telegram Webhook Error:", error.message || error);
      botInitError = error.message || String(error);
      addLog("Bot Webhook Xatosi", `Webhook xatosi: ${error.message || error}`);
    });

    bot.on("error", (error: any) => {
      console.error("Telegram General Error:", error.message || error);
      addLog("Bot Umumiy Xatosi", `Umumiy xato: ${error.message || error}`);
    });
    
    bot.getMe().then((me) => {
      botUsername = me.username || "ultrakinolarbot";
      console.log(`Bot username set to: @${botUsername}`);
    }).catch((err) => {
      console.error("Could not fetch bot username:", err);
    });

    console.log(`Telegram Bot muvaffaqiyatli ulandi (${selectedMode})!`);

    // Log the bot start
    addLog("Bot tizimi", `Telegram Bot ishga tushirildi (${selectedMode}).`);

    // Send startup notification to Super Admins
    const db = loadDb();
    db.admins.forEach((adminId) => {
      bot?.sendMessage(
        adminId,
        `🔔 *Bot Tizimi ishga tushdi!*\n\nTuri: *${selectedMode}* ko'rinishida muvaffaqiyatli ulangan.\nBarcha tizimlar soz holatda.`,
        { parse_mode: "Markdown" }
      ).catch((err) => console.log(`Start xabari admin ${adminId} ga yetkazilmadi:`, err.message));
    });

    setupBotHandlers();
  } catch (err: any) {
    botInitError = err.message || String(err);
    console.error("Telegram Bot initialization error:", err);
    addLog("Bot Xatoliq", `Bot ishga tushishida muammo: ${err.message || err}`);
  }

  return bot;
}

export function getBot() {
  return bot;
}

// Check mandatory subscription
export async function checkSingleSubscription(userId: string, channel: MandatoryChannel): Promise<boolean> {
  if (!bot) return true;
  // If not a telegram channel/group/private, count as subscribed (like YT/Instagram link clicks are trusted or just external)
  if (channel.type !== "channel" && channel.type !== "group" && channel.type !== "private") {
    return true; 
  }

  try {
    const member = await bot.getChatMember(channel.telegram_id, Number(userId));
    const allowed = ["member", "administrator", "creator"];
    return allowed.includes(member.status);
  } catch (err) {
    // If bot is not an admin, we might get an error. In production, we log, but treat as false to enforce setup.
    console.warn(`Obunani tekshirishda xato (${channel.name}, ID: ${channel.telegram_id}):`, err);
    return false;
  }
}

export async function checkAllSubscriptions(userId: string): Promise<{ success: boolean; unsubscribed: MandatoryChannel[] }> {
  const db = loadDb();
  
  // Admins always bypass mandatory join
  if (db.admins.includes(userId)) {
    return { success: true, unsubscribed: [] };
  }

  // Premium users are exempt from mandatory channels to reward their referrals / upgrade
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

// Send Admin Panel (Telegram Interactive)
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
    "👮 *ADMIN PANEL (TELEGRAM MENYUSI)* 👮\n\nHurmatli admin, botni qulay va to'g'ridan-to'g'ri Telegram orqali boshqarish tizimiga xush kelibsiz!\n\nTizim sozlamalari, kinolar, zayafkalar va statistika bilan quyidagi tugmalar yordamida ishlashingiz mumkin:",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: inline
      }
    }
  );
}

// Generate Main Menu Keyboard
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
    const appUrl = db.settings.app_url || process.env.APP_URL || "https://cd2e36ec-43d9-4147-b972-d0e2ff02644f.aistudio-app.com";
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

  // General handler with Flood protection & bot status check
  bot.on("message", async (msg) => {
    if (!bot) return;
    const userId = String(msg.from?.id);
    if (!userId || userId === "undefined") return;

    // Check bottom status (ON/OFF)
    const db = loadDb();
    const isAdmin = db.admins.includes(userId);

    if (!db.settings.is_active && !isAdmin) {
      bot.sendMessage(msg.chat.id, "🛠 *Bot texnik ishlar sababli vaqtincha ishlamayapti.*\n\nTez orada qayta ishga tushiramiz. Sabringiz uchun rahmat!", { parse_mode: "Markdown" });
      return;
    }

    // Flood protection
    const now = Date.now();
    const lastMsgTime = userLastMessageTime[userId] || 0;
    if (now - lastMsgTime < FLOOD_LIMIT_MS) {
      // Ignore spam too fast
      await bot.sendMessage(msg.chat.id, "⚠️ *Iltimos, ketma-ket tez yozmang.* Soniyasiga 1 tadan xabar yuborish ruxsat etilgan.", { parse_mode: "Markdown" });
      userLastMessageTime[userId] = now;
      return;
    }
    userLastMessageTime[userId] = now;

    // Track/Create native user
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

    // Check overall ban status
    if (user.is_banned) {
      await bot.sendMessage(msg.chat.id, "❌ *Siz ushbu botdan bloklangansiz!* Qoidabuzarlik tufayli sizga botdan foydalanish taqiqlangan.", { parse_mode: "Markdown" });
      return;
    }

    const rawText = msg.text || msg.caption || "";
    const text = rawText.trim();
    if (!text) return;

    // SECURITY INTERCEPTOR FOR ADMIN GATEWAY: block unauthorized visitors trying to use admin commands, buttons or shortcuts
    const isTryingAdmin = text === "/admin" || text === "👮 Admin (Telegram)" || text.startsWith("/tgsendall") || text.split(" ")[0].startsWith("#add");
    if (isTryingAdmin && !isAdmin) {
      await bot.sendMessage(msg.chat.id, "❌ *Xatolik:* Siz ushbu bot administratori emassiz! Admin panel faqat tasdiqlangan Admin ID raqamlariga ruxsat beradi.", { parse_mode: "Markdown" });
      return;
    }

    // INTERACTIVE STATE MACHINE FOR ADMINGATEWAY WIZARDS
    if (isAdmin && (text === "/cancel" || text.toLowerCase() === "bekor qilish")) {
      if (adminActiveStates[userId]) {
        delete adminActiveStates[userId];
        await bot.sendMessage(msg.chat.id, "❌ *Faol adminlik jarayoni bekor qilindi.* Yangi buyruq berish uchun /admin bosing.", { parse_mode: "Markdown" });
        return;
      }
    }

    if (isAdmin && adminActiveStates[userId]) {
      const session = adminActiveStates[userId];

      // 1. Waiting for broadcast content input
      if (session.action === "waiting_broadcast") {
        session.data = {
          text: msg.text,
          photo: msg.photo,
          video: msg.video,
          audio: msg.audio,
          document: msg.document,
          caption: msg.caption
        };
        session.step = 2; // confirmed draft
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

      // 2. Interactive cinema wizard
      if (session.action === "adding_movie") {
        if (session.step === 1) {
          session.data.title = text;
          session.step = 2;
          await bot.sendMessage(msg.chat.id, "🔢 *2-Qadam:* Ushbu kino uchun yuklash kod(lar)ini kiriting (Agar bir nechta bo'lsa vergul bilan ajrating, masalan: `112, for10`):\n\n_Eslatma: Kod unikal bo'lishi lozim!_");
          return;
        }
        if (session.step === 2) {
          session.data.codes = text.split(",").map(c => c.trim()).filter(Boolean);
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
            "🎦 *7-Qadam:* Kino faylini yuboring yoki video yuklash havolasini kiriting:\n\n" +
            "💡 _Maslahat: Siz shu yerga to'g'ridan-to'g'ri kino faylini (video) yuklab yuborishingiz mumkin, bot uning Telegram ID (file_id) raqamini o'zi aniqlab oladi va saqlaydi!_"
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
          await bot.sendMessage(msg.chat.id, "🖼 *8-Qadam:* Kino posterining rasmini yoki havolasini yozing (Hajmi chiroyli bo'lishi uchun rasm havolasi ko'proq tavsiya etiladi. O'tkazib yuborish uchun `/skip` deb yozing):");
          return;
        }
        if (session.step === 8) {
          session.data.poster = text === "/skip" ? "" : text;
          session.step = 9;
          await bot.sendMessage(msg.chat.id, "📹 *9-Qadam:* Kino rasmiy treyleri (Youtube) havolasini yozing (O'tkazib yuborish uchun `/skip` deb yozing):");
          return;
        }
        if (session.step === 9) {
          session.data.trailer = text === "/skip" ? "" : text;
          
          const movieData = session.data;
          let summary = `🎬 *YANGI KINO MA'LUMOTLARI VERIFIKATSIYASI* 🎬\n\n` +
            `• 📂 Nomi: *${movieData.title}*\n` +
            `• 🔑 Yuklash Kodlari: ${movieData.codes.map((c: string) => `\`${c}\``).join(", ")}\n` +
            `• 🎭 Janri: *${movieData.genre}*\n` +
            `• 📅 Yili: *${movieData.year}*\n` +
            `• ⭐ Reyting: *${movieData.rating}*\n` +
            `• 📝 Tavsif: _${movieData.description}_\n` +
            `• 🎞 Fayl/Havola: \`${movieData.fileVal.length > 50 ? movieData.fileVal.slice(0, 50) + "..." : movieData.fileVal}\`\n` +
            `• 🖼 Poster: ${movieData.poster ? "Bor ✅" : "Yo'q ❌"}\n` +
            `• 📹 Treyler: ${movieData.trailer ? "Bor ✅" : "Yo'q ❌"}\n\n` +
            `Ushbu kino ma'lumotlarini bazaga saqlaymizmi?`;

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

      // 3. Interactive serial wizard
      if (session.action === "adding_serial") {
        if (session.step === 1) {
          session.data.title = text;
          session.step = 2;
          await bot.sendMessage(msg.chat.id, "🔢 *2-Qadam:* Serial yuklash kod(lar)ini kiriting (Agar bir nechta bo'lsa vergul bilan ajrating, masalan: `5001, s1`):");
          return;
        }
        if (session.step === 2) {
          session.data.codes = text.split(",").map(c => c.trim()).filter(Boolean);
          session.step = 3;
          await bot.sendMessage(msg.chat.id, "🎭 *3-Qadam:* Serial janrini kiriting (masalan: `Drama`, `Koreys`, `Tarixiy`):");
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
            "📺 *7-Qadam (BIRINCHI QISM):*\n\nFasl raqamini, qism raqamini, qism nomini va video faylining o'zini (yoki yuklash havolasini) quyidagi ko'rinishda yuboring:\n\n`Fasl:Qism:Qism_Nomi:Havolasi` (Masalan: `1:1:Uchrashuv:https://t.me/...`)\n\n*Muhim:* Agar video faylni shu yerga to'g'ridan-to'g'ri tashlasangiz, men uni avtomatik ravishda 1-Fasl, 1-Qism ko'rinishida `Ep1` nomi ostida saqlab olaman!"
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
          await bot.sendMessage(msg.chat.id, "🖼 *8-Qadam:* Serial posteri rasmini yoki havolasini yozing (O'tkazib yuborish uchun `/skip`):");
          return;
        }
        if (session.step === 8) {
          session.data.poster = text === "/skip" ? "" : text;
          session.step = 9;
          await bot.sendMessage(msg.chat.id, "📹 *9-Qadam:* Serial treyleri havolasini yozing (O'tkazib yuborish uchun `/skip`):");
          return;
        }
        if (session.step === 9) {
          session.data.trailer = text === "/skip" ? "" : text;

          const serialData = session.data;
          let summary = `📺 *YANGI SERIAL MA'LUMOTLARI VERIFIKATSIYASI* 📺\n\n` +
            `• 📂 Nomi: *${serialData.title}*\n` +
            `• 🔑 Yuklash Kodlari: ${serialData.codes.map((c: string) => `\`${c}\``).join(", ")}\n` +
            `• 🎭 Janri: *${serialData.genre}*\n` +
            `• 📅 Yili: *${serialData.year}*\n` +
            `• ⭐ Reyting: *${serialData.rating}*\n` +
            `• 📝 Tavsif: _${serialData.description}_\n` +
            `• 📺 Birinchi Epizod: Fasl ${serialData.episode.season_num}, Ep ${serialData.episode.episode_num} ("${serialData.episode.title}")\n` +
            `• 🎞 Fayl/Havola: \`${serialData.episode.file_id.length > 50 ? serialData.episode.file_id.slice(0, 50) + "..." : serialData.episode.file_id}\`\n\n` +
            `Ushbu serial ma'lumotlarini hamda birinchi qismini bazaga saqlaymizmi?`;

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

      // 4. Interactive channel wizard
      if (session.action === "adding_channel") {
        if (session.step === 1) {
          session.data.name = text;
          session.step = 2;
          await bot.sendMessage(msg.chat.id, "🔗 *2-Qadam:* Ushbu kanalning havolasini (linkini) kiriting (havola `https://t.me/...` yoki `https://instagram.com/...` ko'rinishida bo'lsin):");
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
          await bot.sendMessage(msg.chat.id, "🆔 *4-Qadam:* Kanalning unikal Telegram ID raqamini kiriting. (Agar telegram kanali yoki guruhi bo'lmasa, ID tekshirish imkonsiz, shuning uchun shunchaki `yo'q` deb yozing):\n\n_Eslatma: ID odatda `-100xxxxxxx` ko'rinishida bo'ladi._");
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

    // ADMIN SHORTCUT COMMANDS
    if (isAdmin) {
      if (text === "/admin" || text === "👮 Admin (Telegram)") {
        await sendAdminPanel(msg.chat.id);
        return;
      }

      // /tgsendall or caption with /tgsendall
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
            } else if (msg.audio) {
              await bot.sendAudio(targetId, msg.audio.file_id, { caption: contentText || undefined, parse_mode: "Markdown" });
            } else if (msg.document) {
              await bot.sendDocument(targetId, msg.document.file_id, { caption: contentText || undefined, parse_mode: "Markdown" });
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
          `✅ *Xabar barchaga yuborib bo'lindi!*\n\n• Muvaffaqiyatli: *${successCount}* ta a'zo\n• Muammo: *${failCount}* ta a'zo (bloklagan bo'lishi mumkin)\n• Jami: *${allUserIds.length}* ta a'zo.`,
          { parse_mode: "Markdown" }
        );
        addLog("Admin Telegram Broadcast", `Admin barcha ${allUserIds.length} foydalanuvchiga xabar tarqatdi.`);
        return;
      }

      // #addchannel Nomi | Havola | Telegram_ID | Turi
      if (text.startsWith("#addchannel")) {
        const parts = text.replace("#addchannel", "").split("|").map(x => x.trim());
        if (parts.length < 4) {
          await bot.sendMessage(msg.chat.id, "⚠️ *Noto'g'ri format!* Iltimos to'liq to'ldiring: `#addchannel Nomi | Havola | Telegram_ID | Turi`", { parse_mode: "Markdown" });
          return;
        }
        const [name, url, telegram_id, type] = parts;
        if (!["channel", "group", "private", "instagram", "youtube"].includes(type)) {
          await bot.sendMessage(msg.chat.id, "⚠️ *Noto'g'ri tur!* Ruxsat etilgan turlar: `channel`, `group`, `private`, `instagram`, `youtube`", { parse_mode: "Markdown" });
          return;
        }
        const newChan = {
          id: Math.random().toString().slice(2, 9),
          name,
          url,
          telegram_id: telegram_id || "yo'q",
          type: type as any
        };
        db.channels.push(newChan);
        saveDb();
        await bot.sendMessage(msg.chat.id, 
          `✅ *Yangi majburiy a'zolik muvaffaqiyatli qo'shildi!*\n\n• Nomi: *${name}*\n• Turi: *${type.toUpperCase()}*\n• Havola: ${url}\n• ID: \`${telegram_id}\``, 
          { parse_mode: "Markdown" }
        );
        addLog("Admin Telegram Channel", `Admin kanal qo'shdi: ${name}`);
        return;
      }

      // #addmovie Sarlavha | Kodlar (vergul bilan ajratilgan) | Janr | Yil | Reyting | Tavsif | Sifat:Fayl_yoki_Havola | Poster | Trailer
      if (text.startsWith("#addmovie")) {
        const parts = text.replace("#addmovie", "").split("|").map(x => x.trim());
        if (parts.length < 7) {
          await bot.sendMessage(msg.chat.id, "⚠️ *Noto'g'ri format!* Kamida 7ta ma'lumot bo'lishi kerak:\n\n`#addmovie Sarlavha | Kodlar | Janr | Yil | Reyting | Tavsif | Sifat:Fayl` [| Poster | Trailer]", { parse_mode: "Markdown" });
          return;
        }
        const [title, codesStr, genre, yearStr, ratingStr, description, qualityStr, poster, trailer] = parts;
        const codes = codesStr.split(",").map(c => c.trim()).filter(Boolean);
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
        await bot.sendMessage(
          msg.chat.id,
          `✅ *Yangi kino muvaffaqiyatli qo'shildi!*\n\n• ID: *${newMovie.id}*\n• Nomi: *${title}*\n• Kod(lar): ${codes.map(c => `\`${c}\``).join(", ")}\n• Janri: *${genre}*\n• Sifati: *${qualityKey}* (${qualityValue})`,
          { parse_mode: "Markdown" }
        );
        addLog("Admin Telegram Movie", `Admin kino qo'shdi: ${title}`);
        return;
      }

      // #addserial Sarlavha | Kodlar | Janr | Yil | Reyting | Tavsif | Fasl:Ep_soni:Ep_nomi:Fayl [| Poster | Trailer]
      if (text.startsWith("#addserial")) {
        const parts = text.replace("#addserial", "").split("|").map(x => x.trim());
        if (parts.length < 7) {
          await bot.sendMessage(msg.chat.id, "⚠️ *Noto'g'ri format!* Kamida 7ta ma'lumot bo'lishi kerak:\n\n`#addserial Sarlavha | Kodlar | Janr | Yil | Reyting | Tavsif | Fasl:Ep_soni:Ep_nomi:Fayl` [| Poster | Trailer]", { parse_mode: "Markdown" });
          return;
        }
        const [title, codesStr, genre, yearStr, ratingStr, description, epDetailStr, poster, trailer] = parts;
        const codes = codesStr.split(",").map(c => c.trim()).filter(Boolean);
        const year = Number(yearStr) || new Date().getFullYear();
        const rating = Number(ratingStr) || 8.0;

        const epParts = epDetailStr.split(":");
        const seasonNum = Number(epParts[0]) || 1;
        const epNum = Number(epParts[1]) || 1;
        const epTitle = epParts[2] || "1-Qism";
        const fileId = epParts[3] || "https://t.me/c/unknown";

        const newSerial = {
          id: db.serials.length > 0 ? Math.max(...db.serials.map((s: any) => s.id), 0) + 1 : 5001,
          codes,
          title,
          description,
          genre,
          year,
          rating,
          poster_url: poster || "",
          trailer_url: trailer || "",
          seasons: [{
            season_num: seasonNum,
            episodes: [{
              episode_num: epNum,
              title: epTitle,
              file_id: fileId
            }]
          }],
          views: 0,
          likes: 0,
          dislikes: 0
        };

        db.serials.push(newSerial);
        saveDb();
        await bot.sendMessage(
          msg.chat.id,
          `✅ *Yangi Serial muvaffaqiyatli qo'shildi!*\n\n• ID: *${newSerial.id}*\n• Nomi: *${title}*\n• Kod(lar): ${codes.map(c => `\`${c}\``).join(", ")}\n• Janri: *${genre}*\n• Birinchi Qism: Fasl ${seasonNum}, Qism ${epNum} (${epTitle})`,
          { parse_mode: "Markdown" }
        );
        addLog("Admin Telegram Serial", `Admin serial qo'shdi: ${title}`);
        return;
      }
    }

    // SUPPORT REPLY DETECTOR (ADMIN SIDE VIA TELEGRAM DIRECTLY)
    // If admin replies to a forwarded support message
    if (isAdmin && msg.reply_to_message) {
      // Find ticket that matches the reply reference
      const replyText = msg.reply_to_message.text || "";
      // Usually, when we forward a ticket update, we suffix it with User Telegram ID
      const match = replyText.match(/Foydalanuvchi ID:\s*([0-9]+)/) || replyText.match(/Tashrifchi:\s*([0-9]+)/);
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

          // Send message to normal user
          bot.sendMessage(
            targetUserId,
            `💬 *Admin javobi:*\n\n${text}\n\n_Savollaringiz bo'lsa yozishda davom etishingiz mumkin._`,
            { parse_mode: "Markdown" }
          ).then(() => {
            bot?.sendMessage(msg.chat.id, "✅ Javob foydalanuvchiga muvaffaqiyatli yuborildi.");
            addLog("Support javoblandi", `User ${targetUserId} telegram orqali javoblandi.`);
          }).catch((err) => {
            bot?.sendMessage(msg.chat.id, `❌ Yuborishda xato: ${err.message}`);
          });

          return;
        }
      }
    }

    // START COMMAND WITH REFERRAL PARSE
    if (text.startsWith("/start")) {
      const match = text.match(/^\/start ref_([0-9]+)$/);
      if (match && match[1]) {
        const referrerId = match[1];
        
        // Ensure user is new and is not referring themselves
        const isNewUser = isBrandNew;
        
        if (referrerId !== userId && isNewUser && !user.referred_by) {
          user.referred_by = referrerId;
          const referrer = db.users[referrerId];
          if (referrer) {
            referrer.referrals_count += 1;
            
            // Premium check: if referrer reaches 10 referrals, auto gift Premium details!
            if (referrer.referrals_count >= 10 && !referrer.is_premium) {
              referrer.is_premium = true;
              bot.sendMessage(
                referrerId,
                "🎉 *Tabriklaymiz!* Siz 10 ta referal yig'dingiz va sizga bepul *PREMIUM* maqomi sovg'a qilindi!\n\nEndi botdan reklamalarsiz va kanal obunalarisiz foydalanishingiz mumkin!",
                { parse_mode: "Markdown" }
              );
            } else {
              bot.sendMessage(
                referrerId,
                `👥 *Yangi referal qo'shildi!*\n\nDo'stingiz botga kirdi. Jami taklif etilganlar: *${referrer.referrals_count}/10* ta.\n_10 ta do'st taklif qiling va bepul VIP Premiumga ega bo'ling!_`,
                { parse_mode: "Markdown" }
              );
            }
          }
          saveDb();
        }
      }

      // Send greeting
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

    // MANDATORY JOIN CHECKER FOR ALL REQUESTS EXCEPT SUPPORT & PROFIL & OTHER ACCIDENTALS
    if (!text.startsWith("💬 Support") && !text.startsWith("👤 Profil") && !text.startsWith("🎁 Referal")) {
      const check = await checkAllSubscriptions(userId);
      if (!check.success) {
        let textChannels = "🛑 *Botdan to'liq foydalanish uchun rasmiy kanallarimizga a'zo bo'lishingiz shart!*\n\nQuyidagi kanallarga qo'shiling va keyin *'✅ A'zo bo'ldim'* tugmasini bosing:\n\n";
        
        const inlineKeyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];
        
        check.unsubscribed.forEach((channel, idx) => {
          let icon = "📢";
          let label = "Kanalga a'zo bo'lish";
          if (channel.type === "group") {
            icon = "👥";
            label = "Guruhga a'zo bo'lish";
          } else if (channel.type === "private") {
            icon = "🔒";
            label = "Yopiq kanalga a'zo bo'lish";
          } else if (channel.type === "instagram") {
            icon = "📸";
            label = "Instagramda kuzatish";
          } else if (channel.type === "youtube") {
            icon = "🔴";
            label = "YouTubega obuna bo'lish";
          }
          textChannels += `${idx + 1}. ${icon} *${channel.name}* (${channel.type.toUpperCase()})\n`;
          inlineKeyboard.push([{ text: `🔗 ${icon} ${label}`, url: channel.url }]);
        });

        inlineKeyboard.push([{ text: "✅ A'zo bo'ldim", callback_data: "check_channels_join" }]);

        await bot.sendMessage(msg.chat.id, textChannels, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        });
        return;
      }
    }

    // MAIN NAVIGATION SWAP
    switch (text) {
      case "🔍 Kino qidirish":
        userActiveState[userId] = "idle";
        await bot.sendMessage(
          msg.chat.id,
          "🔍 *Kino qidirish tizimi:*\n\nKino yoki serial kodini kiriting (masalan: `1001`, `AVATAR`).\nYoki kino/serial nomini kiriting. Bot tezkorlik bilan ma'lumotlarni qidirib topadi.",
          { parse_mode: "Markdown" }
        );
        break;

      case "🎬 Yangi kinolar":
        userActiveState[userId] = "idle";
        await showNewMovies(msg.chat.id, userId);
        break;

      case "🏆 Top kinolar":
        userActiveState[userId] = "idle";
        await showTopMovies(msg.chat.id, userId);
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
        await showSerialsList(msg.chat.id, userId);
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
          "📝 *Kino so'rash (Zayafka) bo'limi:*\n\nBotda siz istagan kino topilmadimi? Bizga yuboring!\n\n*Kino nomini to'g'ridan-to'g'ri shu yerga yozib yuborishingiz mumkin!* (Zayafka yuborish rejimi faollashdi ✨).\n\nNamuna: `Forsaj 10 kinosini yuklang`\n\nAdminlarimiz qabul qilgach sizga darhol xabarnoma keladi!",
          { parse_mode: "Markdown" }
        );
        break;

      case "💬 Support":
        userActiveState[userId] = "support";
        await bot.sendMessage(
          msg.chat.id,
          `💬 *Yordam va Muloqot (Support) bo'limi:*\n\n${db.settings.support_msg}\n\n*Aloqa rejimi faollashdi!* Istalgan savol, taklif yoki xabaringizni to'g'ridan-to'g'ri yozib yuborishingiz mumkin (Hech qanday maxsus buyruqlarsiz!).\n\nSiz yozgan har qanday xabar zudlik bilan ma'murlarimizga yetkaziladi va ular javob qaytarishadi.`,
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
            await bot.sendMessage(msg.chat.id, "⚠️ Iltimos, so'ramoqchi bo'lgan kino nomini ko'rsating. Masalan: `/sorash O'rgimchak odam`", { parse_mode: "Markdown" });
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
            
            // Return mode to idle
            userActiveState[userId] = "idle";

            await bot.sendMessage(
              msg.chat.id,
              `✅ *Sizning so'rovingiz qabul qilindi!*\n\nKino: *${reqTitle}*\nSo'rov kodi: *#REQ${reqId}*\n\nAdminlarimiz ko'rib chiqib, kinoni joylashgach sizga xabar beriladi!`,
              { parse_mode: "Markdown" }
            );
            addLog("Mijoz zayafkasi", `User ${userId} kino so'radi: ${reqTitle}`);
          }
        } else if (isSavol) {
          const qText = text.startsWith("/savol") ? text.replace("/savol", "").trim() : text.trim();
          if (!qText) {
            await bot.sendMessage(msg.chat.id, "⚠️ Iltimos, savolingiz matnini kiritib yuboring. Masalan: `/savol Botga qanday kino qo'shsam bo'ladi?`", { parse_mode: "Markdown" });
          } else {
            // Find existing ticket or create new
            let ticket = db.support.find(t => t.user_id === userId && t.status !== "Yopilgan");
            if (!ticket) {
              const ticketId = Math.random().toString().slice(2, 9);
              ticket = {
                id: ticketId,
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

            await bot.sendMessage(
              msg.chat.id,
              "📨 *Sizning murojaatingiz adminga yetkazildi!*\n\nTashakkur! Admin hozirda xabarni o'qib chiqmoqda, javob yaqin orada shu yerga keladi.",
              { parse_mode: "Markdown" }
            );
            
            // Forward message to Admin via Telegram too for on-the-go reply
            db.admins.forEach(adminId => {
              bot?.sendMessage(
                adminId,
                `💬 *Yangi Support Murojaati!*\n\nTashrifchi: ${userId} (@${msg.from?.username || "yo'q"})\nIsm: ${msg.from?.first_name || "Noma'lum"}\nMurojaat:\n"${qText}"\n\n_Javob qaytarish uchun ushbu xabarga 'Reply' qilib yozing._`,
              ).catch(() => {});
            });

            addLog("Support murojaati", `User ${userId} supportga yozdi: ${qText}`);
          }
        } else {
          // SEARCH FLOW: CODE OR NAME
          await handleSearch(msg.chat.id, userId, text);
        }
        break;
      }
    }
  });

  // Handle buttons callbacks
  bot.on("callback_query", async (query) => {
    if (!bot) return;
    const userId = String(query.from.id);
    const data = query.data;
    if (!data) return;

    const db = loadDb();

    // ADMIN TELEGRAM MENUS HANDLER
    if (db.admins.includes(userId)) {
      if (data === "admin_tg_stats") {
        const statsMsg = `📊 *BOT STATISTIKASI (YANGILANGAN)*\n\n` +
          `👥 *Jami foydalanuvchilar:* ${Object.keys(db.users).length} ta\n` +
          `💎 *Premium a'zolar:* ${Object.values(db.users).filter(u => u.is_premium).length} ta\n` +
          `🎬 *Kinolar soni:* ${db.movies.length} ta\n` +
          `📺 *Seriallar soni:* ${db.serials.length} ta\n` +
          `📢 *Majburiy kanallar:* ${db.channels.length} ta\n` +
          `📝 *Kutilayotgan so'rovlar:* ${db.requests.filter(r => r.status === "Kutilmoqda").length} ta\n` +
          `💬 *Ochiq support tizimlari:* ${db.support.filter(t => t.status === "Kutilmoqda").length} ta\n\n` +
          `🕒 _Oxirgi yangilanish: ${new Date().toLocaleTimeString()}_`;

        await bot.sendMessage(query.message!.chat.id, statsMsg, { parse_mode: "Markdown" });
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "admin_tg_broadcast") {
        adminActiveStates[userId] = {
          action: "waiting_broadcast",
          step: 1,
          data: {}
        };
        const broadMsg = `📣 *INTERAKTIV XABAR TARQATISH REJIMI FAOL!* 📣\n\n` +
          `Barcha a'zolarga yubormoqchi bo'lgan xabaringizni ushbu chatga yozing yoki istalgan faylni (rasm, video, rasm+izoh, audio va h.k.) yuklab yuboring.\n\n` +
          `Bot uni barcha foydalanuvchilarga xavfsiz va tezkor ravishda tarqatib beradi!\n\n` +
          `❌ _Bekor qilish uchun:_ /cancel _yoki quyidagi tugmani bosing._`;

        await bot.sendMessage(query.message!.chat.id, broadMsg, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: "admin_cancel_tg_broadcast" }]]
          }
        });
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "admin_tg_channels") {
        let textChans = "📢 *MAJBURIY OBUNALAR RO'YXATI:*\n\n";
        const inlineKeyboard: any[] = [];

        if (db.channels.length === 0) {
          textChans += "Pristine! Hali hech qanday hamkor kanallar qo'shilmagan.";
        } else {
          db.channels.forEach((chan, idx) => {
            let icon = "📢";
            if (chan.type === "group") icon = "👥";
            if (chan.type === "private") icon = "🔒";
            if (chan.type === "instagram") icon = "📸";
            if (chan.type === "youtube") icon = "🔴";

            textChans += `${idx + 1}. ${icon} *${chan.name}* (Turi: ${chan.type.toUpperCase()})\n`;
            inlineKeyboard.push([
              { text: `${icon} ${chan.name}`, url: chan.url },
              { text: "❌ O'chirish", callback_data: `admin_del_chan_${chan.id}` }
            ]);
          });
        }

        inlineKeyboard.push([{ text: "➕ Yangi Kanal Qo'shish", callback_data: "admin_tg_add_chan_guide" }]);

        await bot.sendMessage(query.message!.chat.id, textChans, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "admin_tg_add_chan_guide") {
        const guideMsg = `➕ *YANGI KANAL QO'SHISH YO'RIQNOMASI*\n\n` +
          `Majburiy kanal qo'shish uchun quyidagi ko'rinishda buyruq yuboring:\n\n` +
          `\`\`#addchannel Nomi | Havolasi (URL) | Telegram_ID | Turi\`\`\n\n` +
          `Turlari: \`channel\`, \`group\`, \`private\`, \`youtube\`, \`instagram\`\n\n` +
          `*Telegram ID* faqat telegram guruh yoki ochiq va yopiq kanallarda obunani tekshirish uchun kiritilishi shart. Ochiq va yopiq kanallar uchun siz botni u yerga admin qilib qo'shib, keyin guruh/kanal unikal ID raqamini (masalan: \`-100234567890\`) kiritishingiz kerak.\n` +
          `Youtube va Instagram turlari havolasi uchun ID o'rniga \`yo'q\` deb yozing.`;

        await bot.sendMessage(query.message!.chat.id, guideMsg, { parse_mode: "Markdown" });
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data.startsWith("admin_del_chan_")) {
        const chanId = data.replace("admin_del_chan_", "");
        const iIndex = db.channels.findIndex(c => c.id === chanId);
        if (iIndex !== -1) {
          const removedName = db.channels[iIndex].name;
          db.channels.splice(iIndex, 1);
          saveDb();
          await bot.answerCallbackQuery(query.id, { text: `${removedName} majburiy ro'yxatdan o'chirildi!`, show_alert: true });
          await bot.deleteMessage(query.message!.chat.id, query.message!.message_id).catch(() => {});
        } else {
          await bot.answerCallbackQuery(query.id, { text: "Kanal topilmadi!", show_alert: false });
        }
        return;
      }

      if (data === "admin_tg_requests") {
        const reqs = db.requests.filter(r => r.status === "Kutilmoqda").slice(0, 8);
        if (reqs.length === 0) {
          await bot.sendMessage(query.message!.chat.id, "📝 *KINO SO'ROVLARI (ZAYAFKALAR)*\n\nHozirda kutilayotgan hech qanday ochiq kino so'rovlari mavjud emas! 🎉");
          await bot.answerCallbackQuery(query.id);
          return;
        }

        await bot.sendMessage(query.message!.chat.id, `📝 *KUTILAYOTGAN SO'ROVLAR (OXIRGI ${reqs.length} TA)*:\n\nQuyidagi kino so'rovlarini bevosita tasdiqlashingiz yoki rad etishingiz mumkin:`);

        for (const r of reqs) {
          const inlineReq = [
            [
              { text: "✅ Yuklandi / Bajarildi", callback_data: `admin_req_ok_${r.id}` },
              { text: "❌ Rad etish", callback_data: `admin_req_no_${r.id}` }
            ]
          ];
          await bot.sendMessage(query.message!.chat.id, `👤 *User:* @${r.username || "noma'lum"} (ID: \`${r.user_id}\`)\n🎬 *So'ralgan kino:* *${r.movie_title}*\n📅 *Sana:* ${new Date(r.created_at).toLocaleString("UZ-uz")}`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: inlineReq }
          });
        }
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data.startsWith("admin_req_ok_")) {
        const reqId = data.replace("admin_req_ok_", "");
        const reqIndex = db.requests.findIndex(r => r.id === reqId);
        if (reqIndex !== -1) {
          const req = db.requests[reqIndex];
          req.status = "Bajarildi";
          saveDb();

          await bot.sendMessage(
            req.user_id,
            `🎉 *Siz so'ragan kino qo'shildi!*\n\nSiz so'ragan *"${req.movie_title}"* kinosi botga muvaffaqiyatli yuklandi va faollashtirildi! Uni qidiruv menyusida uning nomi yoki kodi bilan qidirib darhol tomosha qilishingiz mumkin. Rahmat!`,
            { parse_mode: "Markdown" }
          ).catch(() => {});

          await bot.answerCallbackQuery(query.id, { text: "Zayafka tasdiqlandi va foydalanuvchiga xabar berildi!", show_alert: true });
          await bot.deleteMessage(query.message!.chat.id, query.message!.message_id).catch(() => {});
        } else {
          await bot.answerCallbackQuery(query.id, { text: "So'rov topilmadi!", show_alert: false });
        }
        return;
      }

      if (data.startsWith("admin_req_no_")) {
        const reqId = data.replace("admin_req_no_", "");
        const reqIndex = db.requests.findIndex(r => r.id === reqId);
        if (reqIndex !== -1) {
          const req = db.requests[reqIndex];
          req.status = "Rad etildi";
          saveDb();

          await bot.sendMessage(
            req.user_id,
            `⚠️ *Zayafka rad etildi!*\n\nSiz so'ragan *"${req.movie_title}"* kinosini ba'zi mualliflik huquqi cheklovlari yoki sifatsizligi sababli botga joylashtirish rad etildi. Boshqa kinolarimizni tomosha qilishingiz mumkin!`,
            { parse_mode: "Markdown" }
          ).catch(() => {});

          await bot.answerCallbackQuery(query.id, { text: "Zayafka rad etildi va foydalanuvchiga xabar yetkazildi!", show_alert: true });
          await bot.deleteMessage(query.message!.chat.id, query.message!.message_id).catch(() => {});
        } else {
          await bot.answerCallbackQuery(query.id, { text: "So'rov topilmadi!", show_alert: false });
        }
        return;
      }

      if (data === "admin_tg_add_content") {
        const addInline = [
          [
            { text: "🎬 Kino qo'shish (wizard)", callback_data: "admin_wz_start_movie" },
            { text: "📺 Serial qo'shish (wizard)", callback_data: "admin_wz_start_serial" }
          ],
          [
            { text: "📢 Majburiy obuna qo'shish", callback_data: "admin_wz_start_channel" },
            { text: "⚙️ Yo'riqnoma (Klassik)", callback_data: "admin_wz_guide" }
          ],
          [{ text: "❌ Bekor qilish / Chiqish", callback_data: "admin_cancel_tg_broadcast" }]
        ];

        await bot.sendMessage(
          query.message!.chat.id,
          "🎬 *KINO, SERIAL YOKI KANAL QO'SHISH MENYUSI*\n\nTugmalarni bosing va bosqichma-bosqich, osonlik bilan ma'lumotlarni kiriting:",
          {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: addInline }
          }
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "admin_tg_toggle_bot") {
        db.settings.is_active = !db.settings.is_active;
        saveDb();
        const activeStatusText = db.settings.is_active ? "🟢 FAOL" : "🔴 TEXNIK TANAFFUS";
        await bot.answerCallbackQuery(query.id, { text: `Bot holati muvaffaqiyatli o'zgartirildi: ${activeStatusText}!`, show_alert: true });
        
        try {
          await bot.editMessageReplyMarkup({
            inline_keyboard: [
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
                { text: `⚠️ Bot Holati: ${db.settings.is_active ? "🟢 FAOL" : "🔴 TEXNIK"}`, callback_data: "admin_tg_toggle_bot" }
              ]
            ]
          }, {
            chat_id: query.message!.chat.id,
            message_id: query.message!.message_id
          });
        } catch (e) {}
        return;
      }

      // INTERACTIVE WIZARD START AND ACTION HANDLERS
      if (data === "admin_wz_start_movie") {
        adminActiveStates[userId] = {
          action: "adding_movie",
          step: 1,
          data: {}
        };
        await bot.sendMessage(query.message!.chat.id, "🎬 *KINO QO'SHISH WIZARDI BOSHLANDI!*\n\n*1-Qadam:* Kino sarlavhasini (nomini) yozib yuboring (masalan: `Forsaj 10`):\n\n_Eslatma: Istalgan vaqtda bekor qilish uchun_ /cancel _yoki bekor qilish deb yozing._");
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "admin_wz_start_serial") {
        adminActiveStates[userId] = {
          action: "adding_serial",
          step: 1,
          data: {}
        };
        await bot.sendMessage(query.message!.chat.id, "📺 *SERIAL QO'SHISH WIZARDI BOSHLANDI!*\n\n*1-Qadam:* Serial sarlavhasini (nomini) yozib yuboring (masalan: `Qashqirlar Makoni`):\n\n_Eslatma: Istalgan vaqtda bekor qilish uchun_ /cancel _yoki bekor qilish deb yozing._");
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "admin_wz_start_channel") {
        adminActiveStates[userId] = {
          action: "adding_channel",
          step: 1,
          data: {}
        };
        await bot.sendMessage(query.message!.chat.id, "📢 *MAJBURIY KANAL QO'SHISH WIZARDI BOSHLANDI!*\n\n*1-Qadam:* Hamkorlik kanali yoki guruhining sarlavhasini (nomini) yozib yuboring (masalan: \`UZ Kino Dunyosi\`):\n\n_Eslatma: Istalgan vaqtda bekor qilish uchun_ /cancel _yoki bekor qilish deb yozing._");
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "admin_wz_guide") {
        const instMsg = `🎬 *TEZKOR BUYRUQLAR YO'RIQNOMASI*\n\nAgar bosqichma-bosqich kiritishni xohlamasangiz, quyidagi tayyor matn formatidan foydalanib bitta xabarda yuklang:\n\n` +
          `🎬 *KINO UChUN:* \n` +
          `\`\`#addmovie Sarlavha | Kodlar (vergul bilan) | Janri | Yili | Reytingi (10likda) | Tavsifi | Turi/Sifati:Havolasi_yoki_fayl_id [| Poster_url | Trailer_url]\`\`\n\n` +
          `📺 *SERIAL UChUN:* \n` +
          `\`\`#addserial Sarlavha | Kodlar (vergul bilan) | Janri | Yili | Reytingi (10likda) | Tavsifi | Fasl:Qism_soni:Qism_nomi:Fayl_id_yoki_havolasi [| Poster_url | Trailer_url]\`\`\n\n` +
          `📢 *KANAL UChUN:* \n` +
          `\`\`#addchannel Nomi | Havolasi (URL) | Telegram_ID | Turi\`\``;

        await bot.sendMessage(query.message!.chat.id, instMsg, { parse_mode: "Markdown" });
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // GENRE SELECTION INNER CALLBACKS
      if (data.startsWith("admin_mv_genre_")) {
        const selectedGenre = data.replace("admin_mv_genre_", "");
        const session = adminActiveStates[userId];
        if (session && session.action === "adding_movie" && session.step === 3) {
          session.data.genre = selectedGenre;
          session.step = 4;
          await bot.sendMessage(query.message!.chat.id, `✅ Janr tanlandi: *${selectedGenre}*\n\n📅 *4-Qadam:* Kino chiqarilgan yilini kiriting (masalan: \`2024\`):`, { parse_mode: "Markdown" });
        }
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // CHANNEL TYPE INNER CALLBACKS
      if (data.startsWith("admin_chan_type_")) {
        const selectedType = data.replace("admin_chan_type_", "");
        const session = adminActiveStates[userId];
        if (session && session.action === "adding_channel" && session.step === 3) {
          session.data.type = selectedType;
          session.step = 4;
          await bot.sendMessage(query.message!.chat.id, `✅ Tur tanlandi: *${selectedType.toUpperCase()}*\n\n🆔 *4-Qadam:* Kanal/Guruhning unikal Telegram ID raqamini kiriting. (Agar telegram hamkori bo'lmasa, shunchaki \`yo'q\` deb yozing):`, { parse_mode: "Markdown" });
        }
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // CANCEL STATE INNER CALLBACK
      if (data === "admin_cancel_tg_broadcast") {
        delete adminActiveStates[userId];
        await bot.sendMessage(query.message!.chat.id, "❌ *Barcha faol adminlik jarayonlari bekor qilindi.*", { parse_mode: "Markdown" });
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // CONFIRM BROADCAST INNER CALLBACK
      if (data === "admin_confirm_tg_broadcast") {
        const session = adminActiveStates[userId];
        if (!session || session.action !== "waiting_broadcast" || !session.data) {
          await bot.answerCallbackQuery(query.id, { text: "Xabar topilmadi yoki bekor qilingan!", show_alert: true });
          return;
        }

        await bot.answerCallbackQuery(query.id, { text: "Xabar tarqatish boshlandi...", show_alert: false });
        await bot.sendMessage(query.message!.chat.id, "⏳ *Xabar tarqatish boshlandi...* Iltimos, yakunlanishini kuting. Barcha a'zolarga yuborilmoqda.", { parse_mode: "Markdown" });

        const msgData = session.data;
        const allUserIds = Object.keys(db.users);
        let successCount = 0;
        let failCount = 0;

        for (const targetId of allUserIds) {
          try {
            if (msgData.photo && msgData.photo.length > 0) {
              const fileId = msgData.photo[msgData.photo.length - 1].file_id;
              await bot.sendPhoto(targetId, fileId, { caption: msgData.caption || undefined, parse_mode: "Markdown" });
            } else if (msgData.video) {
              await bot.sendVideo(targetId, msgData.video.file_id, { caption: msgData.caption || undefined, parse_mode: "Markdown" });
            } else if (msgData.audio) {
              await bot.sendAudio(targetId, msgData.audio.file_id, { caption: msgData.caption || undefined, parse_mode: "Markdown" });
            } else if (msgData.document) {
              await bot.sendDocument(targetId, msgData.document.file_id, { caption: msgData.caption || undefined, parse_mode: "Markdown" });
            } else {
              await bot.sendMessage(targetId, msgData.text, { parse_mode: "Markdown" });
            }
            successCount++;
          } catch (err) {
            failCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 35));
        }

        await bot.sendMessage(
          query.message!.chat.id,
          `✅ *Xabar barchaga yuborib bo'lindi!*\n\n• Muvaffaqiyatli: *${successCount}* ta a'zo\n• Muammo: *${failCount}* ta a'zo (bloklagan bo'lishi mumkin)\n• Jami: *${allUserIds.length}* ta a'zo.`,
          { parse_mode: "Markdown" }
        );
        addLog("Admin Telegram Broadcast", `Admin barcha ${allUserIds.length} foydalanuvchiga interaktiv xabar tarqatdi.`);
        delete adminActiveStates[userId];
        return;
      }

      // CONFIRM SAVE MOVIE INNER CALLBACK
      if (data === "admin_confirm_save_movie") {
        const session = adminActiveStates[userId];
        if (!session || session.action !== "adding_movie" || !session.data) {
          await bot.answerCallbackQuery(query.id, { text: "Xato ko'rsatkich yoki bekor qilingan!", show_alert: true });
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

        await bot.sendMessage(
          query.message!.chat.id,
          `✅ *Muvaffaqiyat:* Yangi kino muvaffaqiyatli bazaga kiritildi!\n\n• *ID:* ${newMovie.id}\n• *Kino Sarlavhasi:* ${newMovie.title}\n• *Yuklash Kodlari:* ${newMovie.codes.join(", ")}`,
          { parse_mode: "Markdown" }
        );
        addLog("Admin Telegram Movie Wizard", `Admin interaktiv tarzda yangi kino qo'shdi: ${newMovie.title}`);
        delete adminActiveStates[userId];
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // CONFIRM SAVE SERIAL INNER CALLBACK
      if (data === "admin_confirm_save_serial") {
        const session = adminActiveStates[userId];
        if (!session || session.action !== "adding_serial" || !session.data) {
          await bot.answerCallbackQuery(query.id, { text: "Xato ko'rsatkich yoki bekor qilingan!", show_alert: true });
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

        await bot.sendMessage(
          query.message!.chat.id,
          `✅ *Muvaffaqiyat:* Yangi serial va uning 1-qismi bazaga kiritildi!\n\n• *ID:* ${newSerial.id}\n• *Serial Sarlavhasi:* ${newSerial.title}\n• *Yuklash Kodlari:* ${newSerial.codes.join(", ")}`,
          { parse_mode: "Markdown" }
        );
        addLog("Admin Telegram Serial Wizard", `Admin interaktiv tarzda yangi serial va birinchi qism qo'shdi: ${newSerial.title}`);
        delete adminActiveStates[userId];
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // CONFIRM SAVE CHANNEL INNER CALLBACK
      if (data === "admin_confirm_save_channel") {
        const session = adminActiveStates[userId];
        if (!session || session.action !== "adding_channel" || !session.data) {
          await bot.answerCallbackQuery(query.id, { text: "Xato ko'rsatkich yoki bekor qilingan!", show_alert: true });
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

        await bot.sendMessage(
          query.message!.chat.id,
          `✅ *Muvaffaqiyat:* Yangi majburiy obuna kanali ro'yxatga kiritildi!\n\n• *Nomi:* ${newChan.name}\n• *Turi:* ${newChan.type.toUpperCase()}`,
          { parse_mode: "Markdown" }
        );
        addLog("Admin Telegram Channel Wizard", `Admin interaktiv tarzda majburiy kanal qo'shdi: ${newChan.name}`);
        delete adminActiveStates[userId];
        await bot.answerCallbackQuery(query.id);
        return;
      }
    }

    // Check mandatory channels callback
    if (data === "check_channels_join") {
      const check = await checkAllSubscriptions(userId);
      if (check.success) {
        await bot.answerCallbackQuery(query.id, { text: "Obunalar muvaffaqiyatli tekshirildi! Rahmat.", show_alert: true });
        await bot.deleteMessage(query.message!.chat.id, query.message!.message_id).catch(() => {});
        await bot.sendMessage(
          query.message!.chat.id,
          "🎉 *Ajoyib! Barcha kanallarga a'zo bo'lganingiz tasdiqlandi.*\n\nEndi botdan to'liq foydalana olasiz! Menyu tugmalaridan birini tanlang.",
          { parse_mode: "Markdown", reply_markup: getMainMenu(userId) }
        );
      } else {
        let textAlert = "❌ Quyidagi kanallarga a'zo bo'lmagansiz:\n";
        check.unsubscribed.forEach((c, idx) => {
          textAlert += `${idx+1}. ${c.name}\n`;
        });
        await bot.answerCallbackQuery(query.id, { text: textAlert, show_alert: true });
      }
      return;
    }

    // Like/Dislike movie handler
    if (data.startsWith("like_") || data.startsWith("dislike_")) {
      const isLike = data.startsWith("like_");
      // Format: like_movie_ID or like_serial_ID
      const parts = data.split("_");
      const subType = parts[1]; // movie or serial
      const id = Number(parts[2]);

      // Check if already voted
      const existVote = db.votes.find(v => v.user_id === userId && v.movie_id === id && v.is_serial === (subType === "serial"));
      if (existVote) {
        if (existVote.type === (isLike ? "like" : "dislike")) {
          await bot.answerCallbackQuery(query.id, { text: "Siz allaqachon ovoz bergansiz!", show_alert: false });
          return;
        } else {
          // Change vote type
          existVote.type = isLike ? "like" : "dislike";
          // Update counters
          if (subType === "movie") {
            const m = db.movies.find(x => x.id === id);
            if (m) {
              if (isLike) {
                m.likes += 1;
                m.dislikes = Math.max(0, m.dislikes - 1);
              } else {
                m.dislikes += 1;
                m.likes = Math.max(0, m.likes - 1);
              }
            }
          } else {
            const s = db.serials.find(x => x.id === id);
            if (s) {
              if (isLike) {
                s.likes += 1;
                s.dislikes = Math.max(0, s.dislikes - 1);
              } else {
                s.dislikes += 1;
                s.likes = Math.max(0, s.likes - 1);
              }
            }
          }
          saveDb();
          await bot.answerCallbackQuery(query.id, { text: "Ovozingiz o'zgartirildi!", show_alert: false });
        }
      } else {
        // Create new vote
        db.votes.push({
          user_id: userId,
          movie_id: id,
          is_serial: (subType === "serial"),
          type: isLike ? "like" : "dislike"
        });
        if (subType === "movie") {
          const m = db.movies.find(x => x.id === id);
          if (m) {
            if (isLike) m.likes += 1;
            else m.dislikes += 1;
          }
        } else {
          const s = db.serials.find(x => x.id === id);
          if (s) {
            if (isLike) s.likes += 1;
            else s.dislikes += 1;
          }
        }
        saveDb();
        await bot.answerCallbackQuery(query.id, { text: "Ovozingiz qabul qilindi! Rahmat.", show_alert: false });
      }

      // Re-render voting box details
      let votesCountText = "";
      if (subType === "movie") {
        const m = db.movies.find(x => x.id === id);
        if (m) votesCountText = `👍 ${m.likes} | 👎 ${m.dislikes}`;
      } else {
        const s = db.serials.find(x => x.id === id);
        if (s) votesCountText = `👍 ${s.likes} | 👎 ${s.dislikes}`;
      }

      // Refresh markup
      try {
        await bot.editMessageReplyMarkup({
          inline_keyboard: query.message!.reply_markup!.inline_keyboard.map((row) => {
            return row.map((btn) => {
              if (btn.callback_data?.startsWith("like_") || btn.callback_data?.startsWith("dislike_")) {
                if (btn.callback_data === data) {
                  return { ...btn, text: btn.text + " ✅" };
                }
              }
              return btn;
            });
          })
        }, {
          chat_id: query.message!.chat.id,
          message_id: query.message!.message_id
        });
      } catch (e) {}
      return;
    }

    // Add favorites handler
    if (data.startsWith("fav_")) {
      const parts = data.split("_");
      const isSerial = parts[1] === "serial";
      const id = Number(parts[2]);
      
      const sessionUser = db.users[userId];
      if (!sessionUser) return;

      const profileFavKey = isSerial ? `fav_serial_${id}` : `fav_movie_${id}`;
      // Let's store favorites as lists in users or metadata.
      // We can also just store it inside votes or a custom array database.
      // Let's store it inside memory or a customized favorites record cache!
      // To keep it simple and compliant under User model, let's track a global favorites model on DB.
      // Wait! Since User TS Interface does not declare 'favorites', we can just store it as votes where type = "fav".
      const existFav = db.votes.find(v => v.user_id === userId && v.movie_id === id && v.is_serial === isSerial && v.type === "fav" as any);
      if (existFav) {
        // Remove from favorite
        db.votes = db.votes.filter(v => !(v.user_id === userId && v.movie_id === id && v.is_serial === isSerial && v.type === "fav" as any));
        saveDb();
        await bot.answerCallbackQuery(query.id, { text: "Sevimlilardan olib tashlandi!", show_alert: false });
        
        // Update button text to "❤️ Sevimlilarga"
        try {
          await bot.editMessageReplyMarkup({
            inline_keyboard: query.message!.reply_markup!.inline_keyboard.map((row) => {
              return row.map((btn) => {
                if (btn.callback_data === data) {
                  return { text: "❤️ Sevimlilarga qo'shish", callback_data: data };
                }
                return btn;
              });
            })
          }, {
            chat_id: query.message!.chat.id,
            message_id: query.message!.message_id
          });
        } catch (e) {}
      } else {
        db.votes.push({
          user_id: userId,
          movie_id: id,
          is_serial: isSerial,
          type: "fav" as any
        });
        saveDb();
        await bot.answerCallbackQuery(query.id, { text: "Sevimlilarga qo'shildi!", show_alert: false });
        
        // Update button text to "💚 Sevimlilardan o'chirish"
        try {
          await bot.editMessageReplyMarkup({
            inline_keyboard: query.message!.reply_markup!.inline_keyboard.map((row) => {
              return row.map((btn) => {
                if (btn.callback_data === data) {
                  return { text: "💚 Sevimlilardan o'chirish", callback_data: data };
                }
                return btn;
              });
            })
          }, {
            chat_id: query.message!.chat.id,
            message_id: query.message!.message_id
          });
        } catch (e) {}
      }
      return;
    }

    // Genre items clicked
    if (data.startsWith("genre_")) {
      const selectedGenre = data.replace("genre_", "");
      const movies = db.movies.filter(m => m.genre && m.genre.toLowerCase() === selectedGenre.toLowerCase());
      const serials = db.serials.filter(s => s.genre && s.genre.toLowerCase() === selectedGenre.toLowerCase());

      if (movies.length === 0 && serials.length === 0) {
        await bot.sendMessage(query.message!.chat.id, `📚 *${selectedGenre}* janrida hozircha hech qanday kino yoki serial joylanmagan.`, { parse_mode: "Markdown" });
      } else {
        let listText = `📚 *${selectedGenre.toUpperCase()}* janridagi barcha kinolar:\n\n`;
        movies.forEach((m) => {
          listText += `🎬 *${m.title}* (Kodi: \`${m.codes[0]}\`)\n`;
        });
        if (serials.length > 0) {
          listText += `\n📺 *Seriallar:*\n`;
          serials.forEach((s) => {
            listText += `📺 *${s.title}* (Kodi: \`${s.codes[0]}\`)\n`;
          });
        }
        await bot.sendMessage(query.message!.chat.id, listText, { parse_mode: "Markdown" });
      }
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // Movie download file ID delivery callback
    if (data.startsWith("dl_movie_")) {
      const parts = data.split("_");
      const movieId = Number(parts[2]);
      const quality = parts.slice(3).join("_");

      const m = db.movies.find(x => x.id === movieId);
      if (m) {
        const normQuality = quality.replace(/_/g, " ");
        let fileId = (m.video_quality_urls as any)[normQuality];
        if (!fileId) {
          const keys = Object.keys(m.video_quality_urls || {});
          const matchedKey = keys.find(k => k.toLowerCase() === normQuality.toLowerCase() || k.replace(/ /g, "_").toLowerCase() === quality.toLowerCase());
          if (matchedKey) {
            fileId = (m.video_quality_urls as any)[matchedKey];
          } else if (keys.length > 0) {
            fileId = (m.video_quality_urls as any)[keys[0]];
          }
        }

        if (fileId) {
          m.downloads += 1;
          saveDb();

          await bot.answerCallbackQuery(query.id, { text: "Kino yuborilmoqda. Iltimos, ozgina kuting...", show_alert: false });
          
          const infoMsg = await bot.sendMessage(
            query.message!.chat.id,
            `📥 *"${m.title}"* kinosi yuklanmoqda...\nSifat: *${normQuality}*\n\n_Iltimos, video yuklanishini kuting..._`,
            { parse_mode: "Markdown" }
          );

          await bot.sendVideo(query.message!.chat.id, fileId, {
            caption: `🎬 *${m.title}*\n\n⭐ Reyting: ${m.rating}\n📅 Yil: ${m.year}\n\n🤖 @${botUsername} orqali yuklab olindi.`,
            parse_mode: "Markdown"
          }).then(() => {
            bot?.deleteMessage(query.message!.chat.id, infoMsg.message_id).catch(() => {});
          }).catch(async (errVideo) => {
            await bot.sendDocument(query.message!.chat.id, fileId, {
              caption: `🎬 *${m.title}*\n\n⭐ Reyting: ${m.rating}\n📅 Yil: ${m.year}\n\n🤖 @${botUsername} orqali yuklab olindi.`,
              parse_mode: "Markdown"
            }).then(() => {
              bot?.deleteMessage(query.message!.chat.id, infoMsg.message_id).catch(() => {});
            }).catch(async (errDocs) => {
              await bot?.deleteMessage(query.message!.chat.id, infoMsg.message_id).catch(() => {});
              await bot?.sendMessage(
                query.message!.chat.id,
                `❌ *Faylni yuborishda xatolik yuz berdi!*\n\nAgar bu video havolasi bo'lsa, quyidagi linkdan foydalaning:\n🔗 ${fileId}`,
                { parse_mode: "Markdown" }
              );
            });
          });
        } else {
          await bot.answerCallbackQuery(query.id, { text: "Kino fayli topilmadi!", show_alert: true });
        }
      } else {
        await bot.answerCallbackQuery(query.id, { text: "Kino topilmadi!", show_alert: true });
      }
      return;
    }

    // Serial episode select callback
    if (data.startsWith("serial_ep_")) {
      // Format serial_ep_ID_SEASON_EPISODE
      const parts = data.split("_");
      const serialId = Number(parts[2]);
      const seasonNum = Number(parts[3]);
      const epNum = Number(parts[4]);

      const serial = db.serials.find(s => s.id === serialId);
      if (serial) {
        const season = serial.seasons.find(s => s.season_num === seasonNum);
        const ep = season?.episodes.find(e => e.episode_num === epNum);
        if (ep) {
          // Send episode
          serial.views += 1;
          saveDb();
          
          await bot.sendMessage(
            query.message!.chat.id,
            `📺 *${serial.title}* — ${seasonNum}-Fasl, ${epNum}-Qism\n\nNom: _${ep.title || "Nomsiz"}_`,
            { parse_mode: "Markdown" }
          );
          
          // Send video file if valid ID, else inform user
          if (ep.file_id) {
            await bot.sendVideo(query.message!.chat.id, ep.file_id, {
              caption: `🎬 ${serial.title} s${seasonNum}e${epNum}`
            }).catch(async (e) => {
              // Fallback if file ID is not valid or actually a post link
              await bot?.sendMessage(
                query.message!.chat.id,
                `🔗 *Kino Video Havolasi:* ${ep.file_id}\n\n_Server yukini yuklatmaslik uchun post havolasiga o'ting._`,
                { parse_mode: "Markdown" }
              );
            });
          } else {
            await bot.sendMessage(query.message!.chat.id, "❌ Video fayli biriktirilmagan.");
          }
        }
      }
      await bot.answerCallbackQuery(query.id);
      return;
    }
  });
}

// SEARCH FLOW CONTROLLER
async function handleSearch(chatId: number, userId: string, text: string) {
  const db = loadDb();

  // Save history
  db.history.unshift({
    id: Math.random().toString().slice(2, 9),
    user_id: userId,
    query: text,
    timestamp: new Date().toISOString()
  });
  if (db.history.length > 500) {
    db.history = db.history.slice(0, 500);
  }
  saveDb();

  // Search movies by code
  let m = db.movies.find(x => x.codes.some(c => c.toLowerCase() === text.toLowerCase()));
  if (m) {
    await showMovieCard(chatId, userId, m);
    return;
  }

  // Search serials by code
  let s = db.serials.find(x => x.codes.some(c => c.toLowerCase() === text.toLowerCase()));
  if (s) {
    await showSerialCard(chatId, userId, s);
    return;
  }

  // Match by Title (approx)
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
    const inline_keyboard: any[] = [];

    matchesMovies.forEach((item) => {
      responseText += `🎬 *${item.title}* (Kod: \`${item.codes[0]}\`) [MD]\n`;
      inline_keyboard.push([{ text: `🎬 ${item.title} (${item.year})`, callback_data: `check_channels_join` /* triggers a recheck, fallback search */ }]);
    });

    matchesSerials.forEach((item) => {
      responseText += `📺 *${item.title}* (Kod: \`${item.codes[0]}\`) [TV]\n`;
    });

    responseText += `\n_Ko'rish uchun kino kodini kiriting!_`;
    await bot?.sendMessage(chatId, responseText, { parse_mode: "Markdown" });
    return;
  }

  // Auto-numbered code helper if it looks like numerical search
  if (!isNaN(Number(text))) {
    await bot?.sendMessage(
      chatId,
      "❌ *Ushbu kodli kino topilmadi!*\n\nNomini kiritib qidirib ko'ring yoki kino so'rash uchun `📝 Kino so'rash` bo'limiga murojaat qiling.",
      { parse_mode: "Markdown" }
    );
  } else {
    await bot?.sendMessage(
      chatId,
      `❌ *"${text}" bo'yicha hech narsa topilmadi!*\n\nBoshqa kalit so'z bilan qidirib ko'ring yoki kino kodini kiriting.`,
      { parse_mode: "Markdown" }
    );
  }
}

// SHOW MOVIE DETAILS CARD
async function showMovieCard(chatId: number, userId: string, movie: Movie) {
  if (!bot) return;
  const db = loadDb();
  
  movie.views += 1;
  saveDb();

  let caption = `🎬 *${movie.title}*\n\n`;
  caption += `📅 *Yil:* ${movie.year} | 🌐 *Janr:* ${movie.genre}\n`;
  caption += `⭐ *Reyting:* ${movie.rating}/10\n\n`;
  caption += `📖 *Tafsilot:* ${movie.description || "Tavsif belgilanmagan."}\n\n`;
  caption += `🔑 *Kino kodlari:* ${movie.codes.map(c => `\`${c}\``).join(", ")}\n`;
  caption += `👁 *Ko'rishlar:* ${movie.views} | 📥 *Yuklashlar:* ${movie.downloads}\n\n`;
  
  // High quality details info
  caption += `🎞 *Mavjud sifatlar:* ${Object.keys(movie.video_quality_urls || {}).join(", ") || "Full HD"}\n`;

  const isFavorite = db.votes.some(v => v.user_id === userId && v.movie_id === movie.id && v.is_serial === false && v.type === "fav" as any);

  // Keyboard
  const inline: any[] = [];
  
  // Likes/Dislikes row
  inline.push([
    { text: `👍 ${movie.likes || 0}`, callback_data: `like_movie_${movie.id}` },
    { text: `👎 ${movie.dislikes || 0}`, callback_data: `dislike_movie_${movie.id}` }
  ]);

  // Download links by qualities
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
  if (qualitiesRow.length > 0) {
    inline.push(qualitiesRow);
  }

  // Trailer + Favorites
  const trailerAndFavRow: any[] = [];
  if (movie.trailer_url) {
    trailerAndFavRow.push({ text: "🎬 Trailer ko'rish", url: movie.trailer_url });
  }
  
  trailerAndFavRow.push({ 
    text: isFavorite ? "💚 Sevimlilardan o'chirish" : "❤️ Sevimlilarga qo'shish", 
    callback_data: `fav_movie_${movie.id}` 
  });
  inline.push(trailerAndFavRow);

  // If there's a poster, send photos, else simple text card
  if (movie.poster_url && movie.poster_url.trim().startsWith("http")) {
    await bot.sendPhoto(chatId, movie.poster_url, {
      caption: caption,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: inline
      }
    }).catch(async (err) => {
      // Fallback
      await bot?.sendMessage(chatId, caption, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: inline
        }
      });
    });
  } else {
    await bot.sendMessage(chatId, caption, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: inline
      }
    });
  }

  // Track download metrics if they clicked
  movie.downloads += 1;
  saveDb();
}

// SHOW TV SERIAL CARD WITH SEASONS
async function showSerialCard(chatId: number, userId: string, serial: Serial) {
  if (!bot) return;
  const db = loadDb();

  let caption = `📺 *SERIAL:* *${serial.title}*\n\n`;
  caption += `📅 *Yil:* ${serial.year} | 🌐 *Janr:* ${serial.genre}\n`;
  caption += `⭐ *Reyting:* ${serial.rating}/10\n\n`;
  caption += `📖 *Tafsilot:* ${serial.description || "Tavsif belgilanmagan."}\n\n`;
  caption += `🔑 *Serial kodi:* \`${serial.codes[0]}\`\n`;
  caption += `👁 *Ko'rishlar:* ${serial.views || 0}\n\n`;

  const isFavorite = db.votes.some(v => v.user_id === userId && v.movie_id === serial.id && v.is_serial === true && v.type === "fav" as any);

  // Interactive Season Selector menu
  const inline: any[] = [];
  inline.push([
    { text: `👍 ${serial.likes || 0}`, callback_data: `like_serial_${serial.id}` },
    { text: `👎 ${serial.dislikes || 0}`, callback_data: `dislike_serial_${serial.id}` }
  ]);

  // Favorites
  inline.push([
    { text: isFavorite ? "💚 Sevimlilardan o'chirish" : "❤️ Sevimlilarga qo'shish", callback_data: `fav_serial_${serial.id}` }
  ]);

  if (serial.trailer_url) {
    inline.push([{ text: "🎬 Trailer ko'rish", url: serial.trailer_url }]);
  }

  // Season Buttons
  serial.seasons.forEach((season) => {
    // Show top 5 episodes inline quickly, or list of episodes as direct buttons
    const row: any[] = [];
    season.episodes.forEach((ep) => {
      row.push({ 
        text: `F${season.season_num} Q${ep.episode_num}`, 
        callback_data: `serial_ep_${serial.id}_${season.season_num}_${ep.episode_num}` 
      });
    });
    // Chunkey array of 4 episodes per row
    for (let i = 0; i < row.length; i += 4) {
      inline.push(row.slice(i, i + 4));
    }
  });

  if (serial.poster_url && serial.poster_url.trim().startsWith("http")) {
    await bot.sendPhoto(chatId, serial.poster_url, {
      caption: caption,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: inline
      }
    }).catch(async () => {
      await bot?.sendMessage(chatId, caption, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: inline
        }
      });
    });
  } else {
    await bot.sendMessage(chatId, caption, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: inline
      }
    });
  }
}

// QUICK LISTINGS HANDLERS
async function showNewMovies(chatId: number, userId: string) {
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

async function showTopMovies(chatId: number, userId: string) {
  const db = loadDb();
  const sorted = [...db.movies].sort((a,b) => b.views - a.views).slice(0, 10);
  if (sorted.length === 0) {
    await bot?.sendMessage(chatId, "🏆 Top kinolar hozircha mavjud emas.");
    return;
  }
  let txt = "🏆 *ENG KO'P KO'RILGAN TOP KINOLAR:* \n\n";
  sorted.forEach((item, idx) => {
    txt += `${idx + 1}. *${item.title}* — Kod: \`${item.codes[0]}\` | 👁 \`${item.views}\` marta ko'rilgan\n`;
  });
  txt += "\n_Ko'rish uchun kino kodini yozib yuboring!_";
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
  // Unique genres
  const genresSet = new Set<string>();
  db.movies.forEach(m => { if (m.genre) genresSet.add(m.genre) });
  db.serials.forEach(s => { if (s.genre) genresSet.add(s.genre) });
  
  // Custom baseline genres in Uzbekistan:
  ["Jangari", "Komediya", "Drama", "Fantastika", "Qo'rqinchli", "Triller", "Tarixiy", "Romantik"].forEach(g => genresSet.add(g));

  const list = Array.from(genresSet);
  const inline: any[] = [];
  const row: any[] = [];
  list.forEach((g) => {
    row.push({ text: g, callback_data: `genre_${g}` });
  });

  for (let i = 0; i < row.length; i += 2) {
    inline.push(row.slice(i, i + 2));
  }

  await bot?.sendMessage(chatId, "📚 *Kino va Serial Janrlari:*\n\nJanrni tanlang va ushbu janrdagi kino ro'yxatiga ega bo'ling:", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: inline
    }
  });
}

async function showSerialsList(chatId: number, userId: string) {
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
  const favVotes = db.votes.filter(v => v.user_id === userId && v.type === "fav" as any);
  if (favVotes.length === 0) {
    await bot?.sendMessage(chatId, "❤️ *Sizning sevimlilar ro'yxatingiz bo'sh.* Kinolardagi '❤️' rasmchasini bosish orqali sevimlilar ro'yxatiga qo'shing.", { parse_mode: "Markdown" });
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
  text += "\n_Ko'rish uchun uni kodini kiritib yuboring._";
  await bot?.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

// PROFILE HANDLER WITH INCOME PROPOSALS
async function showProfile(chatId: number, userId: string) {
  const db = loadDb();
  const user = db.users[userId];
  if (!user) return;

  const regDate = new Date(user.joined_at).toLocaleDateString("UZ-uz");

  let text = "👤 *FOYDALANUVChI PROFILI:*\n\n";
  text += `🆔 *Telegram ID:* \`${user.id}\`\n`;
  text += `👤 *Ism:* ${user.first_name || "Mavjud emas"}\n`;
  text += `🔗 *Username:* @${user.username || "yo'q"}\n`;
  text += `📅 *Ro'yxatdan o'tgan sana:* ${regDate}\n`;
  text += `👥 *Taklif etgan referallaringiz:* *${user.referrals_count}* ta\n`;
  text += `🌟 *Premium holat:* ${user.is_premium ? "💎 *VIP PREMIUM FAOL*" : "🔴 Yo'q"}\n\n`;

  if (user.is_premium) {
    text += "👑 *Siz VIP Premium foydalanuvchisiz!* Barcha reklamadan va kanal a'zoligi majburiyatlaridan holisiz! Rahmat.";
  } else {
    text += "💎 *VIP PREMIUM imkoniyatlari:*\n";
    text += "1. Kanallarga a'zo bo'lish majburiyati olib tashlanadi.\n";
    text += "2. Barcha reklama va cheklovlar o'chiriladi.\n";
    text += "3. Tezkor yuklash va 4K sifatni ko'rish imkoni.\n\n";
    text += "🎁 *QANDAY QILIB PREMIUM OLISH MUMKIN?*\n";
    text += "👉 *1-Yo'l:* `10 ta do'stni` referal havola orqali botga taklif qiling (Bepul!).\n";
    text += "👉 *2-Yo'l:* Atigi *15 000 so'm / oy* to'lov qiling.\n\n";
    text += "_To'lov Tafsilotlari: Plastik karta `5614682119199406` (O/Turamirzayev) ga to'lab adminga chek yuboring yoki `🎁 Referal` bo'limiga kiring._";
  }

  await bot?.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

// REFERRAL ENGINE
async function showReferral(chatId: number, userId: string) {
  const db = loadDb();
  const user = db.users[userId];
  if (!user) return;

  const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  let text = "🎁 *HAMKORLIK VA REFERAL TIZIMI:*\n\n";
  text += "Bot do'stlaringizga ham foydali bo'lishi mumkin! Ularni taklif qiling va mukofot oling!\n\n";
  text += `🔗 *Sizning taklif havolangiz:*\n${refLink}\n\n`;
  text += `📊 *Referal holatingiz:*\n`;
  text += `• Siz taklif qilganlar: *${user.referrals_count}* ta\n`;
  text += `• Premiumgacha qoldi: *${Math.max(0, 10 - user.referrals_count)}* ta\n\n`;
  text += "💡 *Qo'llanma:* Havolani nusxalab do'stlaringizga, guruhlarga tarqating. Do'stingiz ushbu havola orqali botga kirib ruxsat bersa, sizga *+1 referal* yoziladi. *10 ta referal* yetti o'lchab VIP Premium bepul beradi!";

  await bot?.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Do'stlarga ulashish", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Eng zo'r Telegram Kino Bot! Istalgan kino va serialni kod orqali tezda toping!")}` }]
      ]
    }
  });
}

// SEARCH HISTORY VIEW
async function showHistory(chatId: number, userId: string) {
  const db = loadDb();
  const hist = db.history.filter(h => h.user_id === userId).slice(0, 10);
  if (hist.length === 0) {
    await bot?.sendMessage(chatId, "📜 Siz hali qidiruv amalga oshirmadingiz.");
    return;
  }

  let text = "📜 *SIZNING OXIRGI QIDIRUV TARIXINGIZ (TOP 10):*\n\n";
  hist.forEach((h, idx) => {
    const timeStr = new Date(h.timestamp).toLocaleTimeString("UZ-uz", { hour: "numeric", minute: "numeric" });
    text += `${idx + 1}. *"${h.query}"* — _soat ${timeStr}_ \n`;
  });
  text += "\n_Tarixdagi biron bir nomni botga yuborib qayta qidirishingiz mumkin._";
  await bot?.sendMessage(chatId, text, { parse_mode: "Markdown" });
}
