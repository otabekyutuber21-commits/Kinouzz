import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { 
  loadDb, 
  saveDb, 
  saveDbImmediately,
  addLog, 
  User, 
  Movie, 
  Serial, 
  SupportTicket, 
  MovieRequest, 
  MandatoryChannel,
  AdCampaign,
  LogEntry,
  BotSettings
} from "./server/db";
import { initBot, getBot, getBotStatus } from "./server/bot";

const app = express();
const PORT = 3000;

app.use(express.json());

// Load DB
const db = loadDb();

// START TELEGRAM BOT
// Retrieve credentials from environment
const BOT_TOKEN = "8802513773:AAEOREvLRKmuDqN-ADQe4Sq2XD9qVryLItg";
initBot(BOT_TOKEN);

// TELEGRAM WEBHOOK ENDPOINT FOR SERVERLESS DEPLOYMENTS
app.post("/api/telegram/webhook", (req, res) => {
  const bot = getBot();
  if (bot) {
    try {
      bot.processUpdate(req.body);
    } catch (err: any) {
      console.error("Webhook processing error:", err.message);
    }
  }
  res.sendStatus(200);
});

// BACKGROUND SCHEDULER FOR RECURRING AD BROADCASTS
// Runs every 30 seconds
setInterval(() => {
  const currentDb = loadDb();
  // Find pending scheduled campaigns that have reached their time
  const now = new Date();
  
  // Find scheduled broadcasts that are pending
  const pendingCampaigns = currentDb.logs.filter(l => false); // just a layout helper
  
  // Custom simple task runner for scheduled messages:
  // We can look for scheduled broadcasts in the logs or define a list.
  // Let's create an easy way. Every campaign created can have statuses.
  // Since we save broadcasts inside logs or settings, we can implement it if requested. 
  // For now, let's keep it clean.
}, 30000);

// API AUTH ROUTE: passwordless Telegram code-based verification
app.post("/api/auth/login", (req, res) => {
  const { admin_id } = req.body;
  if (!admin_id) {
    return res.status(400).json({ success: false, error: "Telegram ID kiritilmadi" });
  }

  const currentDb = loadDb();
  const isAdmin = currentDb.admins.includes(String(admin_id));
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: "Siz admin hisoblanmaysiz!" });
  }

  // Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  currentDb.sessions[admin_id] = {
    admin_id: String(admin_id),
    login_time: new Date().toISOString(),
    login_code: code
  };
  saveDbImmediately();

  const bot = getBot();
  if (bot) {
    bot.sendMessage(
      Number(admin_id),
      `🔑 *KINO BOT PANELGA KIRISh KODI:*\n\nKod: \`${code}\`\n\nUshbu kodni panel login maydoniga kiriting. Havfsizlik sababli uni hech kimga bermang!`,
      { parse_mode: "Markdown" }
    ).then(() => {
      res.json({ success: true, message: "Kodisiz kirish xabari telegramga yuborildi." });
      addLog("Admin panel kirish", `Admin ${admin_id} uchun panelga kirish kodi yuborildi.`);
    }).catch((err) => {
      console.error("Failed to send login message to admin:", err.message);
      res.json({ 
        success: true, 
        message: `Kodni telegramga yuborishda xato, ammo sinov muhiti uchun kod bu yerda: ${code}`, 
        dev_code: code 
      });
    });
  } else {
    res.json({ 
      success: true, 
      message: `Telegram bot ulanmagan. Sinov uchun kod: ${code}`, 
      dev_code: code 
    });
  }
});

app.post("/api/auth/verify", (req, res) => {
  const { admin_id, code } = req.body;
  if (!admin_id || !code) {
    return res.status(400).json({ success: false, error: "Ma'lumotlar to'liq emas" });
  }

  const currentDb = loadDb();
  const session = currentDb.sessions[admin_id];
  if (!session || session.login_code !== String(code)) {
    return res.status(401).json({ success: false, error: "Noto'g'ri tasdiqlash kodi" });
  }

  // Clear code
  delete session.login_code;
  saveDb();

  res.json({ 
    success: true, 
    token: `session_token_${admin_id}_${Math.random().toString().slice(2)}`,
    admin_id 
  });
  addLog("Admin panel kirish", `Admin ${admin_id} tizimga kirdi.`);
});

app.get("/api/auth/verify-telegram-admin", (req, res) => {
  const { admin_id } = req.query;
  if (!admin_id) {
    return res.status(400).json({ success: false, error: "Telegram ID kiritilmadi" });
  }

  const currentDb = loadDb();
  const isAdmin = currentDb.admins.includes(String(admin_id));
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: "Siz admin hisoblanmaysiz!" });
  }

  const token = `session_token_${admin_id}_${Math.random().toString().slice(2)}`;
  currentDb.sessions[String(admin_id)] = {
    admin_id: String(admin_id),
    login_time: new Date().toISOString()
  };
  saveDbImmediately();

  res.json({ success: true, token, admin_id });
  addLog("Admin panel kirish", `Admin ${admin_id} Telegram Mini App orqali tezkor kirdi.`);
});

// API ENDPOINT: STATS
app.get("/api/stats", (req, res) => {
  const currentDb = loadDb();
  const users = Object.values(currentDb.users);
  
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfLast7Days = now.getTime() - (7 * 24 * 60 * 60 * 1000);
  const startOfLast30Days = now.getTime() - (30 * 24 * 60 * 60 * 1000);

  let todayUsers = 0;
  let weeklyUsers = 0;
  let monthlyUsers = 0;

  users.forEach((u) => {
    const joinTime = new Date(u.joined_at).getTime();
    if (joinTime >= startOfToday) todayUsers++;
    if (joinTime >= startOfLast7Days) weeklyUsers++;
    if (joinTime >= startOfLast30Days) monthlyUsers++;
  });

  // Calculate top movie
  let topMovie: Movie | null = null;
  currentDb.movies.forEach((m) => {
    if (!topMovie || m.views > topMovie.views) {
      topMovie = m;
    }
  });

  // Calculate top serial
  let topSerial: Serial | null = null;
  currentDb.serials.forEach((s) => {
    if (!topSerial || s.views > topSerial.views) {
      topSerial = s;
    }
  });

  // Support counters
  const openSupports = currentDb.support.filter(s => s.status !== "Yopilgan").length;
  const pendingRequests = currentDb.requests.filter(r => r.status === "Kutilmoqda").length;

  res.json({
    totalUsers: users.length,
    todayUsers,
    weeklyUsers,
    monthlyUsers,
    totalMovies: currentDb.movies.length,
    totalSerials: currentDb.serials.length,
    totalChannels: currentDb.channels.length,
    openSupports,
    pendingRequests,
    topMovie: topMovie ? { title: (topMovie as Movie).title, views: (topMovie as Movie).views, code: (topMovie as Movie).codes[0] } : null,
    topSerial: topSerial ? { title: (topSerial as Serial).title, views: (topSerial as Serial).views, code: (topSerial as Serial).codes[0] } : null,
    bot_status: getBotStatus()
  });
});

// API: MOVIES CRUD
app.get("/api/movies", (req, res) => {
  const currentDb = loadDb();
  res.json(currentDb.movies);
});

app.post("/api/movies", (req, res) => {
  const { title, description, genre, year, rating, video_quality_urls, poster_url, trailer_url, codes, adminId } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: "Kino nomi majburiy" });
  }

  const currentDb = loadDb();
  
  // Auto code logic if codes are empty
  let finalCodes: string[] = codes || [];
  if (finalCodes.length === 0 || finalCodes[0].trim() === "") {
    // Find biggest numeric code
    let maxCode = 1000;
    currentDb.movies.forEach(m => {
      m.codes.forEach(c => {
        const num = Number(c);
        if (!isNaN(num) && num > maxCode) maxCode = num;
      });
    });
    currentDb.serials.forEach(s => {
      s.codes.forEach(c => {
        const num = Number(c);
        if (!isNaN(num) && num > maxCode) maxCode = num;
      });
    });
    finalCodes = [String(maxCode + 1)];
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
    codes: finalCodes.map(c => c.trim().toUpperCase())
  };

  currentDb.movies.push(newMovie);
  saveDb();
  addLog("Kino Qo'shildi", `Kino "${title}" (Kodi: ${newMovie.codes.join(", ")}) tizimga qo'shildi.`, String(adminId));
  res.json({ success: true, movie: newMovie });
});

app.put("/api/movies/:id", (req, res) => {
  const id = Number(req.params.id);
  const { title, description, genre, year, rating, video_quality_urls, poster_url, trailer_url, codes, adminId } = req.body;

  const currentDb = loadDb();
  const mIndex = currentDb.movies.findIndex(x => x.id === id);
  if (mIndex === -1) {
    return res.status(404).json({ success: false, error: "Kino topilmadi" });
  }

  const currentCodes = codes ? codes.map((c: string) => c.trim().toUpperCase()) : currentDb.movies[mIndex].codes;

  currentDb.movies[mIndex] = {
    ...currentDb.movies[mIndex],
    title: title || currentDb.movies[mIndex].title,
    description: description !== undefined ? description : currentDb.movies[mIndex].description,
    genre: genre || currentDb.movies[mIndex].genre,
    year: year !== undefined ? Number(year) : currentDb.movies[mIndex].year,
    rating: rating !== undefined ? Number(rating) : currentDb.movies[mIndex].rating,
    video_quality_urls: video_quality_urls || currentDb.movies[mIndex].video_quality_urls,
    poster_url: poster_url !== undefined ? poster_url : currentDb.movies[mIndex].poster_url,
    trailer_url: trailer_url !== undefined ? trailer_url : currentDb.movies[mIndex].trailer_url,
    codes: currentCodes
  };

  saveDb();
  addLog("Kino Tahrirlandi", `Kino "${currentDb.movies[mIndex].title}" tahrirlandi.`, String(adminId));
  res.json({ success: true, movie: currentDb.movies[mIndex] });
});

app.delete("/api/movies/:id", (req, res) => {
  const id = Number(req.params.id);
  const { adminId } = req.query;

  const currentDb = loadDb();
  const mIndex = currentDb.movies.findIndex(x => x.id === id);
  if (mIndex === -1) {
    return res.status(404).json({ success: false, error: "Kino topilmadi" });
  }

  const title = currentDb.movies[mIndex].title;
  currentDb.movies.splice(mIndex, 1);
  saveDb();
  addLog("Kino O'chirildi", `Kino "${title}" o'chirildi.`, String(adminId));
  res.json({ success: true });
});

// API: SERIALS CRUD
app.get("/api/serials", (req, res) => {
  const currentDb = loadDb();
  res.json(currentDb.serials);
});

app.post("/api/serials", (req, res) => {
  const { title, description, genre, year, rating, poster_url, trailer_url, codes, seasons, adminId } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: "Serial nomi majburiy" });
  }

  const currentDb = loadDb();
  let finalCodes: string[] = codes || [];
  if (finalCodes.length === 0 || finalCodes[0].trim() === "") {
    let maxCode = 1000;
    currentDb.movies.forEach(m => {
      m.codes.forEach(c => {
        const num = Number(c);
        if (!isNaN(num) && num > maxCode) maxCode = num;
      });
    });
    currentDb.serials.forEach(s => {
      s.codes.forEach(c => {
        const num = Number(c);
        if (!isNaN(num) && num > maxCode) maxCode = num;
      });
    });
    finalCodes = [String(maxCode + 1)];
  }

  const newSerial: Serial = {
    id: Date.now(),
    title,
    description: description || "",
    genre: genre || "Drama",
    year: Number(year) || new Date().getFullYear(),
    rating: Number(rating) || 8.0,
    poster_url: poster_url || "",
    trailer_url: trailer_url || "",
    seasons: seasons || [],
    views: 0,
    likes: 0,
    dislikes: 0,
    codes: finalCodes.map(c => c.trim().toUpperCase())
  };

  currentDb.serials.push(newSerial);
  saveDb();
  addLog("Serial Qo'shildi", `Serial "${title}" (Kodi: ${newSerial.codes.join(", ")}) qo'shildi.`, String(adminId));
  res.json({ success: true, serial: newSerial });
});

app.put("/api/serials/:id", (req, res) => {
  const id = Number(req.params.id);
  const { title, description, genre, year, rating, poster_url, trailer_url, codes, seasons, adminId } = req.body;

  const currentDb = loadDb();
  const sIndex = currentDb.serials.findIndex(x => x.id === id);
  if (sIndex === -1) {
    return res.status(404).json({ success: false, error: "Serial topilmadi" });
  }

  currentDb.serials[sIndex] = {
    ...currentDb.serials[sIndex],
    title: title || currentDb.serials[sIndex].title,
    description: description !== undefined ? description : currentDb.serials[sIndex].description,
    genre: genre || currentDb.serials[sIndex].genre,
    year: year !== undefined ? Number(year) : currentDb.serials[sIndex].year,
    rating: rating !== undefined ? Number(rating) : currentDb.serials[sIndex].rating,
    poster_url: poster_url !== undefined ? poster_url : currentDb.serials[sIndex].poster_url,
    trailer_url: trailer_url !== undefined ? trailer_url : currentDb.serials[sIndex].trailer_url,
    codes: codes ? codes.map((c: string) => c.trim().toUpperCase()) : currentDb.serials[sIndex].codes,
    seasons: seasons || currentDb.serials[sIndex].seasons
  };

  saveDb();
  addLog("Serial Tahrirlandi", `Serial "${currentDb.serials[sIndex].title}" tahrirlandi.`, String(adminId));
  res.json({ success: true, serial: currentDb.serials[sIndex] });
});

app.delete("/api/serials/:id", (req, res) => {
  const id = Number(req.params.id);
  const { adminId } = req.query;

  const currentDb = loadDb();
  const sIndex = currentDb.serials.findIndex(x => x.id === id);
  if (sIndex === -1) {
    return res.status(404).json({ success: false, error: "Serial topilmadi" });
  }

  const title = currentDb.serials[sIndex].title;
  currentDb.serials.splice(sIndex, 1);
  saveDb();
  addLog("Serial O'chirildi", `Serial "${title}" o'chirildi.`, String(adminId));
  res.json({ success: true });
});

// API: MANDATORY CHANNELS
app.get("/api/channels", (req, res) => {
  const currentDb = loadDb();
  res.json(currentDb.channels);
});

app.post("/api/channels", (req, res) => {
  const { name, url, telegram_id, type, adminId } = req.body;
  if (!name || !url) {
    return res.status(400).json({ success: false, error: "Kanal nomi va silkasi majburiy" });
  }

  const currentDb = loadDb();
  const newChan: MandatoryChannel = {
    id: Date.now().toString(),
    name,
    url,
    telegram_id: telegram_id || "",
    type: type || "channel"
  };

  currentDb.channels.push(newChan);
  saveDb();
  addLog("Kanal Qo'shildi", `Majburiy a'zolik: "${name}" (${type}) qo'shildi.`, String(adminId));
  res.json({ success: true, channel: newChan });
});

app.delete("/api/channels/:id", (req, res) => {
  const id = req.params.id;
  const { adminId } = req.query;

  const currentDb = loadDb();
  const cIndex = currentDb.channels.findIndex(x => x.id === id);
  if (cIndex === -1) {
    return res.status(404).json({ success: false, error: "Kanal topilmadi" });
  }

  const name = currentDb.channels[cIndex].name;
  currentDb.channels.splice(cIndex, 1);
  saveDb();
  addLog("Kanal O'chirildi", `Majburiy a'zolik kanali "${name}" olib tashlandi.`, String(adminId));
  res.json({ success: true });
});

// API: SUPPORT CHATS
app.get("/api/support", (req, res) => {
  const currentDb = loadDb();
  res.json(currentDb.support);
});

app.post("/api/support/reply", (req, res) => {
  const { ticketId, text, adminId, adminName } = req.body;
  if (!ticketId || !text) {
    return res.status(400).json({ success: false, error: "Ma'lumotlar to'liq emas" });
  }

  const currentDb = loadDb();
  const ticket = currentDb.support.find(t => t.id === ticketId);
  if (!ticket) {
    return res.status(404).json({ success: false, error: "Mavzu topilmadi" });
  }

  ticket.messages.push({
    sender: "admin",
    text,
    timestamp: new Date().toISOString()
  });
  ticket.status = "Ochiq";
  ticket.last_updated = new Date().toISOString();
  saveDb();

  // Send message through bot!
  const bot = getBot();
  if (bot) {
    bot.sendMessage(
      Number(ticket.user_id),
      `💬 *Admin Javobi:*\n\n${text}\n\n_Bot menyusi orqali savol yozishingiz mumkin._`,
      { parse_mode: "Markdown" }
    ).catch((err) => {
      console.warn("Could not message normal user support reply via Telegram:", err.message);
    });
  }

  addLog("Support Javoblandi", `Mijoz #${ticketId} chatiga javob qaytarildi.`, String(adminId), adminName);
  res.json({ success: true, ticket });
});

app.post("/api/support/close", (req, res) => {
  const { ticketId, adminId } = req.body;
  const currentDb = loadDb();
  const ticket = currentDb.support.find(t => t.id === ticketId);
  if (!ticket) {
    return res.status(404).json({ success: false, error: "Mavzu topilmadi" });
  }

  ticket.status = "Yopilgan";
  saveDb();
  addLog("Support Yopildi", `Mijoz #${ticketId} chati yopildi.`, String(adminId));
  res.json({ success: true, ticket });
});

// API: MOVIE REQUESTS (ZAYAFKALAR)
app.get("/api/requests", (req, res) => {
  const currentDb = loadDb();
  res.json(currentDb.requests);
});

app.post("/api/requests/resolve", (req, res) => {
  const { requestId, status, admin_notes, adminId } = req.body; // status: "Bajarildi" or "Rad etildi"
  if (!requestId || !status) {
    return res.status(400).json({ success: false, error: "Ma'lumotlar to'liq emas" });
  }

  const currentDb = loadDb();
  const request = currentDb.requests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ success: false, error: "So'rov topilmadi" });
  }

  request.status = status;
  request.admin_notes = admin_notes || "";
  saveDb();

  // Notify user on Telegram
  const bot = getBot();
  if (bot) {
    const statusEmoji = status === "Bajarildi" ? "🟢 BAJARILDI" : "🔴 RAD ETILDI";
    let alertMsg = `📣 *Siz so'ragan kino bo'yicha javob keldi!*\n\n`;
    alertMsg += `🎬 *Kino nomi:* ${request.movie_title}\n`;
    alertMsg += `📊 *Holati:* ${statusEmoji}\n`;
    if (admin_notes) {
      alertMsg += `✍️ *Admin izohi:* ${admin_notes}\n`;
    }
    alertMsg += `\n_Tizimimizdan foydalanganiz uchun rahmat!_`;
    
    bot.sendMessage(Number(request.user_id), alertMsg, { parse_mode: "Markdown" }).catch((err) => {
      console.warn("Failed to send resolving notification via telegram:", err.message);
    });
  }

  addLog("Zayafka hal etildi", `So'rov #${requestId} "${status}" holatiga o'tkazildi.`, String(adminId));
  res.json({ success: true, request });
});

// API: BROADCAST MAILING
app.post("/api/broadcast", async (req, res) => {
  const { text, image_url, scheduled_at, adminId } = req.body;
  if (!text) {
    return res.status(400).json({ success: false, error: "Broadcast xabari matni kiritilmadi." });
  }

  const currentDb = loadDb();
  const users = Object.values(currentDb.users);
  
  if (users.length === 0) {
    return res.json({ success: true, message: "Yuborish uchun foydalanuvchilar nomi yo'q.", info: { sent: 0, failed: 0, blocked: 0 } });
  }

  // Record campaign
  const campaignId = Math.random().toString().slice(2, 9);
  
  addLog("Reklama yuborilmoqda", `Hammaga reklama jo'natish boshlandi...`, String(adminId));

  // Run async broadcast to preserve server response time
  let sent = 0;
  let failed = 0;
  let blocked = 0;
  const bot = getBot();

  res.json({ 
    success: true, 
    message: "Reklama xabari barcha foydalanuvchilarga yuborilishi boshlandi. Natijani loglardan ko'rishingiz mumkin.",
    campaignId
  });

  if (!bot) return;

  // Let's loop asynchronously
  for (const user of users) {
    try {
      if (image_url && image_url.trim().startsWith("http")) {
        await bot.sendPhoto(Number(user.id), image_url, {
          caption: text,
          parse_mode: "Markdown"
        });
      } else {
        await bot.sendMessage(Number(user.id), text, {
          parse_mode: "Markdown"
        });
      }
      sent++;
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("blocked") || msg.includes("deactivated") || msg.includes("chat not found")) {
        blocked++;
      } else {
        failed++;
      }
    }
  }

  addLog(
    "Reklama yakunlandi", 
    `Mailing yakuni: Jami: ${sent + failed + blocked} | Yetkazildi: ${sent} | Bloklagan: ${blocked} | Xatolik: ${failed}`,
    String(adminId)
  );
});

// API: SETTINGS
app.get("/api/settings", (req, res) => {
  const currentDb = loadDb();
  res.json(currentDb.settings);
});

app.post("/api/settings", (req, res) => {
  const { bot_name, bot_photo, start_msg, support_msg, ad_msg, instagram_link, youtube_link, is_active, app_url, adminId } = req.body;
  const currentDb = loadDb();

  currentDb.settings = {
    ...currentDb.settings,
    bot_name: bot_name !== undefined ? bot_name : currentDb.settings.bot_name,
    bot_photo: bot_photo !== undefined ? bot_photo : currentDb.settings.bot_photo,
    start_msg: start_msg !== undefined ? start_msg : currentDb.settings.start_msg,
    support_msg: support_msg !== undefined ? support_msg : currentDb.settings.support_msg,
    ad_msg: ad_msg !== undefined ? ad_msg : currentDb.settings.ad_msg,
    instagram_link: instagram_link !== undefined ? instagram_link : currentDb.settings.instagram_link,
    youtube_link: youtube_link !== undefined ? youtube_link : currentDb.settings.youtube_link,
    is_active: is_active !== undefined ? is_active : currentDb.settings.is_active,
    app_url: app_url !== undefined ? app_url : currentDb.settings.app_url,
  };

  saveDb();
  addLog("Sozlamalar o'zgartirildi", `Bot sozlamalari yangilandi.`, String(adminId));
  res.json({ success: true, settings: currentDb.settings });
});

// API: USER BAN / MANAGE
app.get("/api/users", (req, res) => {
  const currentDb = loadDb();
  res.json(Object.values(currentDb.users));
});

app.post("/api/users/ban", (req, res) => {
  const { userId, adminId } = req.body;
  const currentDb = loadDb();
  const u = currentDb.users[userId];
  if (!u) {
    return res.status(404).json({ success: false, error: "Foydalanuvchi topilmadi" });
  }

  u.is_banned = true;
  saveDb();
  addLog("User Bloklandi", `Kullanuvchi ${userId} (@${u.username || "noma'lum"}) tizimdan ban qilindi.`, String(adminId));
  res.json({ success: true, user: u });
});

app.post("/api/users/unban", (req, res) => {
  const { userId, adminId } = req.body;
  const currentDb = loadDb();
  const u = currentDb.users[userId];
  if (!u) {
    return res.status(404).json({ success: false, error: "Foydalanuvchi topilmadi" });
  }

  u.is_banned = false;
  saveDb();
  addLog("User Blokdan Olindi", `Kullanuvchi ${userId} (@${u.username || "noma'lum"}) bandan ozod etildi.`, String(adminId));
  res.json({ success: true, user: u });
});

app.post("/api/users/premium", (req, res) => {
  const { userId, is_premium, adminId } = req.body;
  const currentDb = loadDb();
  const u = currentDb.users[userId];
  if (!u) {
    return res.status(404).json({ success: false, error: "Foydalanuvchi topilmadi" });
  }

  u.is_premium = is_premium;
  saveDb();
  addLog("User Premium Yangilash", `Kullanuvchi ${userId} Premium holati: "${is_premium ? "FAOL" : "ECHILGAN"}" ga yangilandi.`, String(adminId));
  res.json({ success: true, user: u });
});

// API: ADMIN MANAGER
app.get("/api/admins", (req, res) => {
  const currentDb = loadDb();
  res.json(currentDb.admins);
});

app.post("/api/admins", (req, res) => {
  const { newAdminId, adminId } = req.body;
  if (!newAdminId) return res.status(400).json({ error: "ID kiritilmagan" });

  const currentDb = loadDb();
  if (currentDb.admins.includes(String(newAdminId))) {
    return res.status(400).json({ error: "Ushbu foydalanuvchi allaqachon admin" });
  }

  currentDb.admins.push(String(newAdminId));
  saveDb();
  addLog("Yangi Admin Qo'shildi", `ID: ${newAdminId} adminlar safiga qo'shildi.`, String(adminId));
  res.json({ success: true, admins: currentDb.admins });
});

app.delete("/api/admins/:targetId", (req, res) => {
  const targetId = req.params.targetId;
  const { adminId } = req.query;

  if (targetId === "8939863862") {
    return res.status(400).json({ error: "Asosiy Super Admin o'chirilishi taqiqlangan!" });
  }

  const currentDb = loadDb();
  const idx = currentDb.admins.indexOf(String(targetId));
  if (idx === -1) {
    return res.status(404).json({ error: "Admin ruyxatdan topilmadi" });
  }

  currentDb.admins.splice(idx, 1);
  saveDb();
  addLog("Admin O'chirildi", `ID: ${targetId} adminlar safidan chiqarildi.`, String(adminId));
  res.json({ success: true, admins: currentDb.admins });
});

// SYSTEM LOGS GETTER
app.get("/api/logs", (req, res) => {
  const currentDb = loadDb();
  res.json(currentDb.logs);
});

// BACKUP EXPORT / RESTORE
app.get("/api/backup", (req, res) => {
  const currentDb = loadDb();
  res.json(currentDb);
});

async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
