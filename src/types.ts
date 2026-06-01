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

export interface DashboardStats {
  totalUsers: number;
  todayUsers: number;
  weeklyUsers: number;
  monthlyUsers: number;
  totalMovies: number;
  totalSerials: number;
  totalChannels: number;
  openSupports: number;
  pendingRequests: number;
  topMovie: { title: string; views: number; code: string } | null;
  topSerial: { title: string; views: number; code: string } | null;
  bot_status: string;
}
