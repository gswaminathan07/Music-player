export type TrackMood =
  | 'Chill'
  | 'Focus'
  | 'Energetic'
  | 'Melancholic'
  | 'Uplifting'
  | 'Groovy'
  | 'Ambient';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  genre: string;
  mood: TrackMood;
  bpm?: number;
  coverGradient?: string;
  coverUrl?: string;
  audioUrl?: string; // synthetic audio or blob url or /api/audio/:id
  isLocal: boolean;
  isOfflineAvailable: boolean;
  isCloudSynced?: boolean; // Uploaded from laptop/device and synced across devices
  uploadedAt?: number;
  fileSize?: number;
  format?: 'MP3' | 'FLAC' | 'WAV' | 'M4A' | 'OGG' | 'SYNTH';
  bitrate?: string;
  playCount: number;
  lastPlayed?: number;
  liked: boolean;
  blobId?: string; // IndexedDB key
  lyrics?: string[];
  karaokeLyrics?: KaraokeLyricLine[];
  vibeSummary?: string;
  language?: string; // e.g. 'Tamil', 'Hindi', 'Korean', 'Spanish', 'Japanese', 'English', etc.
  culturalGenre?: string; // e.g. 'Tamil Cinema Melody', 'K-Pop', 'Latin Urbano', 'Afrobeats'
  syncOffset?: number; // User-calibrated manual lyric sync offset in seconds (e.g. -0.4 or +0.6)
}

export interface KaraokeLyricLine {
  id?: string;
  time: number; // in seconds, e.g. 14.5
  endTime?: number; // in seconds, e.g. 18.2
  text: string;
  romanized?: string; // phonetics/transliteration for international songs
  translation?: string; // English translation for international songs
  words?: { word: string; time: number; duration: number }[];
}

export interface SongLyricsData {
  trackId: string;
  title: string;
  artist: string;
  language?: string;
  culturalGenre?: string;
  isSynced: boolean;
  source: 'google' | 'id3' | 'studio' | 'lrclib' | 'not_found';
  googleSearchQuery?: string;
  detectedScript?: string;
  searchCitation?: string;
  syncOffset?: number;
  lines: KaraokeLyricLine[];
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  trackIds: string[];
  coverGradient: string;
  coverEmoji?: string;
  coverUrl?: string;
  isDailyMix?: boolean;
  isAiGenerated?: boolean;
  isSmartPlaylist?: boolean;
  moodCategory?: string;
  genreCategory?: string;
  languageCategory?: string;
  culturalContext?: string;
  createdAt: string;
  curator?: string;
  followers?: number;
}

export interface SmartPlaylistRequest {
  mode: 'by-genre' | 'international' | 'auto-all' | 'custom';
  targetGenre?: string;
  targetLanguage?: string;
  customPrompt?: string;
}

export interface SmartPlaylistGenerated {
  id: string;
  title: string;
  description: string;
  genreCategory: string;
  languageCategory?: string;
  culturalContext?: string;
  coverGradient: string;
  coverEmoji?: string;
  selectedTrackIds: string[];
  trackCount: number;
}

export interface SmartFolder {
  id: string;
  name: string;
  description: string;
  genreOrMood: string;
  coverGradient: string;
  coverEmoji: string;
  playlistIds: string[];
  trackCount: number;
}

export interface UserPreferences {
  favoriteGenres: string[];
  dailyVibe: string;
  activities: string[];
  smartShuffleMood: TrackMood | 'All';
  audioQuality: '320kbps' | 'Lossless FLAC' | 'Master Audio';
  theme: 'dark-oled' | 'dark-violet' | 'dark-cyber' | 'light';
  platformLook: 'ios' | 'android';
  offlineOnlyMode: boolean;
  keepScreenAwake?: boolean;
}

export interface EqualizerSettings {
  enabled: boolean;
  preset: string;
  bands: number[]; // 10 bands: -12dB to +12dB
  bassBoost: number; // 0 to 100
  spatialSurround: number; // 0 to 100
  preamp: number; // -6 to +6 dB
}

export interface OnlineRecommendation {
  title: string;
  artist: string;
  album: string;
  genre: string;
  mood: string;
  matchReason: string;
  similarityScore: number;
  suggestedTags: string[];
}

export interface CommunityCurator {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  verified: boolean;
  bio: string;
  playlists: Playlist[];
}

export interface ListeningStats {
  totalPlays: number;
  totalMinutesListened: number;
  likedCount: number;
  genreBreakdown: Record<string, number>;
  moodBreakdown: Record<string, number>;
}
