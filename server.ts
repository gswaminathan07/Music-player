import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Directory for persistent cloud audio files and synced libraries
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const CLOUD_LIBRARY_FILE = path.join(UPLOAD_DIR, 'cloud-library.json');
const CLOUD_STATE_FILE = path.join(UPLOAD_DIR, 'cloud-state.json');

function loadCloudTracks(): any[] {
  try {
    if (fs.existsSync(CLOUD_LIBRARY_FILE)) {
      const data = fs.readFileSync(CLOUD_LIBRARY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Error reading cloud-library.json:', err);
  }
  return [];
}

function saveCloudTracks(tracks: any[]): void {
  try {
    fs.writeFileSync(CLOUD_LIBRARY_FILE, JSON.stringify(tracks, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing cloud-library.json:', err);
  }
}

function loadCloudState(): any {
  try {
    if (fs.existsSync(CLOUD_STATE_FILE)) {
      const data = fs.readFileSync(CLOUD_STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Ignore
  }
  return null;
}

function saveCloudState(state: any): void {
  try {
    fs.writeFileSync(CLOUD_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing cloud-state.json:', err);
  }
}

app.use(express.json({ limit: '20mb' }));

// In-memory sync store for cloud sync simulation
const cloudSyncStore: Record<string, { profile: any; timestamp: number }> = {};

// Helper to clean song titles and artist names of downloader watermarks, rippers, or track numbering
function sanitizeSongTitleAndArtist(text: string): string {
  if (!text) return '';
  let s = text;
  // Remove bracketed website watermarks, rippers, or bitrates
  s = s.replace(/\[[^\]]*(?:masstamilan|starmusiq|isaimini|tamilwire|sensong|kuttyweb|mallumusic|atozmp3|naasong|pagalworld|mp3mad|hungama|gaana|jiosaavn|wynk|320\s*kbps|128\s*kbps|kbps|rip|official|audio|video|lyrics?|download)[^\]]*\]/gi, '');
  s = s.replace(/\([^)]*(?:masstamilan|starmusiq|isaimini|tamilwire|sensong|kuttyweb|mallumusic|atozmp3|naasong|pagalworld|mp3mad|hungama|gaana|jiosaavn|wynk|320\s*kbps|128\s*kbps|kbps|rip|official|audio|video|lyrics?|download)[^)]*\)/gi, '');
  // Standalone downloader domains or tags
  s = s.replace(/\b(?:masstamilan|starmusiq|isaimini|tamilwire|sensongsmp3?|kuttyweb|mallumusic|atozmp3|naasongs?|pagalworld|mp3mad)[a-z0-9._-]*\b/gi, '');
  s = s.replace(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|dev|in|so|net|org|co|info|cc|xyz|vip)\b/gi, '');
  s = s.replace(/\b\d{2,3}\s*k(?:bps)?\b/gi, '');
  // Common regional and junk tags
  s = s.replace(/\[(?:Tamil|Telugu|Hindi|Malayalam|Kannada)\]/gi, '');
  s = s.replace(/\((?:Tamil|Telugu|Hindi|Malayalam|Kannada)\)/gi, '');
  s = s.replace(/\.(mp3|flac|wav|m4a|aac|ogg)$/gi, '');
  // Leading track numbering like "01 - " or "378. "
  s = s.replace(/^\s*#?\d{1,4}(?:[.-]|\s+)\s*/, '');
  // Clean edge hyphens and excessive spacing
  s = s.replace(/\s*[-–—]\s*[-–—]\s*/g, ' - ');
  s = s.replace(/^[-–—:._|~/\s]+|[-–—:._|~/\s]+$/g, '');
  return s.replace(/\s{2,}/g, ' ').trim();
}

// Helper to get GoogleGenAI client
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const AI_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

function safeParseJson(raw: string | undefined): any | null {
  if (!raw) return null;
  let text = raw.trim();
  if (text.startsWith('```json')) {
    text = text.slice(7);
  } else if (text.startsWith('```')) {
    text = text.slice(3);
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3);
  }
  text = text.trim();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function generateWithGemini(prompt: string): Promise<any | null> {
  const ai = getGenAI();
  if (!ai) return null;

  for (const model of AI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      const parsed = safeParseJson(response.text);
      if (parsed) return parsed;
    } catch {
      // Quietly fall back to next model or local heuristic
      continue;
    }
  }
  return null;
}

// 1. Curate Daily Playlists based on user preferences and track library
app.post('/api/ai/curate-daily', async (req: Request, res: Response) => {
  const { libraryTracks, preferences, targetMood } = req.body;

  try {
    const prompt = `You are an expert music curator and DJ for an audiophile music player app.
User preferences:
- Favorite Genres: ${JSON.stringify(preferences?.favoriteGenres || ['Lo-Fi', 'Electronic', 'Indie', 'Synthwave'])}
- Today's Desired Vibe: ${preferences?.dailyVibe || targetMood || 'Energetic Focus'}
- Current Activity: ${JSON.stringify(preferences?.activities || ['Work', 'Relaxation'])}

Available Library Tracks:
${JSON.stringify(
  (libraryTracks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    genre: t.genre,
    mood: t.mood,
  }))
)}

Create 3 distinct Daily Playlists tailored to the user's day:
1. Daily Mix 1: Primed for high focus or morning energy
2. Daily Mix 2: Sunset / Afternoon flow
3. Daily Mix 3: Evening unwind / Night vibe

For each playlist, select existing track IDs from the library that fit best (at least 3-6 tracks each).
Provide the response strictly in JSON format matching this schema:
{
  "playlists": [
    {
      "title": "string (e.g. Daily Mix 1: Morning Focus Flow)",
      "description": "string (curator notes)",
      "moodCategory": "string (e.g. Focus, Energetic, Chill)",
      "coverGradient": "string (Tailwind gradient classes, e.g. from-violet-600 via-indigo-600 to-sky-500)",
      "coverEmoji": "string (single emoji)",
      "selectedTrackIds": ["string track id 1", "string track id 2"]
    }
  ]
}
Return only JSON.`;

    const parsed = await generateWithGemini(prompt);
    if (parsed && Array.isArray(parsed.playlists) && parsed.playlists.length > 0) {
      return res.json(parsed);
    }
  } catch {
    // Graceful fallback below
  }

  return res.json({
    playlists: [
      {
        title: `Daily Mix 1: ${targetMood || preferences?.dailyVibe || 'Morning Momentum'}`,
        description: 'Acoustic clarity and steady rhythmic pacing to elevate your focus.',
        moodCategory: 'Focus',
        coverGradient: 'from-amber-500 via-rose-500 to-indigo-600',
        coverEmoji: '🌅',
        selectedTrackIds: (libraryTracks || []).slice(0, 5).map((t: any) => t.id),
      },
      {
        title: 'Daily Mix 2: Sunset Synth & Pulse',
        description: 'Uplifting harmonies and retro analog drive for peak afternoon flow.',
        moodCategory: 'Energetic',
        coverGradient: 'from-fuchsia-600 via-pink-600 to-purple-800',
        coverEmoji: '🌆',
        selectedTrackIds: (libraryTracks || []).slice(1, 6).map((t: any) => t.id),
      },
      {
        title: 'Daily Mix 3: Late Night Horizon',
        description: 'Deep spatial ambient reverbs and soothing lo-fi warmth to decompress.',
        moodCategory: 'Chill',
        coverGradient: 'from-indigo-700 via-blue-800 to-slate-900',
        coverEmoji: '🌌',
        selectedTrackIds: (libraryTracks || []).slice(2, 7).map((t: any) => t.id),
      },
    ],
  });
});

// 2. Scan and auto-organize library tracks into mood-based and genre-specific folders
app.post('/api/ai/organize', async (req: Request, res: Response) => {
  const { libraryTracks, customGoal } = req.body;

  try {
    const prompt = `You are an AI music library organizer.
User Request: ${customGoal || 'Sort all tracks into mood-based and genre-specific curated collections / folders.'}

Tracks to organize:
${JSON.stringify(
  (libraryTracks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    genre: t.genre,
    mood: t.mood,
  }))
)}

Group these tracks into 3 to 6 logical, inspiring folders/playlists (e.g. "Late Night Lo-Fi & Ambient", "High-BPM Workout Pulse", "Indie Melancholy & Acoustic", "Cyber Synthwave & Groove").
Ensure every track is placed into the most appropriate folder (tracks can belong to more than one folder if fitting).
Return strictly valid JSON:
{
  "folders": [
    {
      "folderName": "string",
      "description": "string",
      "genreOrMood": "string",
      "coverGradient": "string (Tailwind gradient e.g. from-rose-500 via-pink-600 to-purple-600)",
      "coverEmoji": "string (1 emoji)",
      "trackIds": ["trackId1", "trackId2"]
    }
  ]
}
Return only JSON.`;

    const parsed = await generateWithGemini(prompt);
    if (parsed && Array.isArray(parsed.folders) && parsed.folders.length > 0) {
      return res.json(parsed);
    }
  } catch {
    // Graceful fallback below
  }

  const groups: Record<string, string[]> = {
    'Lo-Fi Study & Coffeehouse': [],
    'Midnight Drive & Synthwave': [],
    'Deep Focus & Ambient Drift': [],
    'High Voltage & Workout': [],
  };

  (libraryTracks || []).forEach((t: any) => {
    if (t.genre?.includes('Lo-Fi') || t.mood === 'Chill') {
      groups['Lo-Fi Study & Coffeehouse'].push(t.id);
    } else if (t.genre?.includes('Synth') || t.mood === 'Groovy') {
      groups['Midnight Drive & Synthwave'].push(t.id);
    } else if (t.mood === 'Focus' || t.mood === 'Ambient') {
      groups['Deep Focus & Ambient Drift'].push(t.id);
    } else {
      groups['High Voltage & Workout'].push(t.id);
    }
  });

  const gradients = [
    'from-amber-600 via-orange-700 to-stone-800',
    'from-pink-600 via-purple-700 to-indigo-900',
    'from-blue-600 via-indigo-700 to-slate-900',
    'from-rose-600 via-red-600 to-amber-600',
  ];
  const emojis = ['☕', '⚡', '🧘', '🔥'];

  const folders = Object.entries(groups)
    .filter(([_, ids]) => ids.length > 0)
    .map(([name, ids], idx) => ({
      folderName: name,
      description: `Auto-organized collection of ${ids.length} tracks.`,
      genreOrMood: name,
      coverGradient: gradients[idx % gradients.length],
      coverEmoji: emojis[idx % emojis.length],
      trackIds: ids,
    }));

  return res.json({ folders });
});

// 3. Smart Shuffle based on listening history, current mood & harmonic transition
app.post('/api/ai/smart-shuffle', async (req: Request, res: Response) => {
  const { libraryTracks, currentTrackId, currentMood, listeningHistory } = req.body;

  try {
    const prompt = `You are the Smart Shuffle engine of Vettify music player.
Current Track: ${JSON.stringify(libraryTracks?.find((t: any) => t.id === currentTrackId) || null)}
User Selected Mood: ${currentMood || 'Any'}
Listening Stats / History: ${JSON.stringify(listeningHistory || {})}

Available Library Tracks:
${JSON.stringify(
  (libraryTracks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    genre: t.genre,
    mood: t.mood,
    playCount: t.playCount || 0,
  }))
)}

Generate an intelligent track playback order (queue) that:
1. Aligns with current mood (${currentMood})
2. Creates smooth energy flow (no jarring BPM / acoustic jumps)
3. Incorporates tracks user enjoys while introducing discovery tracks
4. Avoids immediate repeats

Return strictly valid JSON:
{
  "queueTrackIds": ["trackId1", "trackId2"],
  "rationale": "A 1-sentence explanation of this smart queue curation"
}
Return only JSON.`;

    const parsed = await generateWithGemini(prompt);
    if (parsed && Array.isArray(parsed.queueTrackIds) && parsed.queueTrackIds.length > 0) {
      return res.json(parsed);
    }
  } catch {
    // Fall through to heuristic
  }

  // Smart heuristic shuffle: rank by mood alignment, genre harmony, and variety
  const tracks = [...(libraryTracks || [])];
  const current = tracks.find((t: any) => t.id === currentTrackId);
  const scored = tracks
    .filter((t: any) => t.id !== currentTrackId)
    .map((t: any) => {
      let score = Math.random() * 20;
      if (currentMood && currentMood !== 'All' && t.mood?.toLowerCase() === currentMood?.toLowerCase()) {
        score += 40;
      }
      if (current && t.genre && current.genre && t.genre.toLowerCase() === current.genre.toLowerCase()) {
        score += 25;
      }
      if (t.liked) score += 15;
      return { track: t, score };
    });

  scored.sort((a, b) => b.score - a.score);
  const queueTrackIds = scored.map((s) => s.track.id);

  return res.json({
    queueTrackIds: queueTrackIds.length > 0 ? queueTrackIds : tracks.map((t: any) => t.id),
    rationale: `Harmonically queued for your ${currentMood || 'balanced'} listening session.`,
  });
});

// 4. Online Music Recommendations based on user library preferences
app.post('/api/ai/recommend', async (req: Request, res: Response) => {
  const { libraryTracks, preferences, targetVibe } = req.body;

  try {
    const sampleArtists = (libraryTracks || []).map((t: any) => t.artist).filter(Boolean).slice(0, 6);
    const sampleGenres = (libraryTracks || []).map((t: any) => t.genre).filter(Boolean).slice(0, 6);

    const prompt = `You are an AI music recommendation expert with encyclopedic knowledge of global music catalogs.
The user is listening to their local MP3 library with:
- Artists in library: ${JSON.stringify(sampleArtists)}
- Genres in library: ${JSON.stringify(sampleGenres)}
- Target Vibe / Activity: ${targetVibe || preferences?.dailyVibe || 'Ethereal Discovery'}
- Preferred Genres: ${JSON.stringify(preferences?.favoriteGenres || [])}

Recommend 6 real-world songs and artists from online streaming platforms that this user would love based on their library acoustic profile.
For each song provide:
- title: string
- artist: string
- album: string
- genre: string
- mood: string
- matchReason: string (why it fits their library)
- similarityScore: number (between 85 and 99)
- suggestedTags: array of 3 string tags

Return strictly valid JSON:
{
  "recommendations": [
    {
      "title": "string",
      "artist": "string",
      "album": "string",
      "genre": "string",
      "mood": "string",
      "matchReason": "string",
      "similarityScore": 95,
      "suggestedTags": ["tag1", "tag2", "tag3"]
    }
  ]
}
Return only JSON.`;

    const parsed = await generateWithGemini(prompt);
    if (parsed && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
      return res.json(parsed);
    }
  } catch {
    // Fall through
  }

  return res.json({
    recommendations: [
      {
        title: 'Solaris Drift',
        artist: 'Kavinsky & Tycho',
        album: 'Neon Horizon',
        genre: 'Synthwave / Chillwave',
        mood: 'Chill',
        matchReason: 'Matches your love for atmospheric synthesizers and steady tempos.',
        similarityScore: 96,
        suggestedTags: ['Retro', 'Driving', 'Warm'],
      },
      {
        title: 'Midnight Reverie',
        artist: 'Kiasmos',
        album: 'Blurred',
        genre: 'Minimal Techno',
        mood: 'Focus',
        matchReason: 'Seamless companion for deep work sessions with organic piano and light beats.',
        similarityScore: 94,
        suggestedTags: ['Acoustic', 'Nordic', 'Deep'],
      },
      {
        title: 'Coffee in Shibuya',
        artist: 'Jinsang',
        album: 'Life',
        genre: 'Lo-Fi Hip Hop',
        mood: 'Chill',
        matchReason: 'Warm vinyl crackle and mellow jazz chords fitting your daily mix.',
        similarityScore: 91,
        suggestedTags: ['Vinyl', 'Study', 'Japan'],
      },
      {
        title: 'Weightless Flow',
        artist: 'Marconi Union',
        album: 'Ambient Works',
        genre: 'Ambient',
        mood: 'Ambient',
        matchReason: 'Calibrated acoustic tempo designed for slow breathing and low cognitive friction.',
        similarityScore: 89,
        suggestedTags: ['Chill', 'Drone', 'Calm'],
      },
    ],
  });
});

// 5. Analyze an uploaded track (filename, tag hints) to predict genre, mood, acoustic vibe
app.post('/api/ai/analyze-track', async (req: Request, res: Response) => {
  const { filename, metadata } = req.body;

  try {
    const prompt = `Analyze this music track based on its metadata and filename:
Filename: ${filename}
Title: ${metadata?.title || 'Unknown'}
Artist: ${metadata?.artist || 'Unknown'}
Existing Genre tag: ${metadata?.genre || 'Unknown'}

Predict the most accurate:
1. genre (e.g. Lo-Fi, Synthwave, Indie Pop, Ambient, Deep House, Neo-Soul, Rock, Classical)
2. mood (one of: 'Chill', 'Focus', 'Energetic', 'Melancholic', 'Uplifting', 'Groovy', 'Ambient')
3. vibeSummary (1 short sentence describing the acoustic atmosphere)
4. suggestedBpm (approximate integer)

Return strictly valid JSON:
{
  "genre": "string",
  "mood": "string",
  "vibeSummary": "string",
  "suggestedBpm": 120
}
Return only JSON.`;

    const parsed = await generateWithGemini(prompt);
    if (parsed && parsed.genre && parsed.mood) {
      return res.json(parsed);
    }
  } catch {
    // Fall through
  }

  const lower = (filename || '').toLowerCase();
  let genre = metadata?.genre || 'Alternative';
  let mood = 'Chill';

  if (lower.includes('lofi') || lower.includes('chill') || lower.includes('coffee')) {
    genre = 'Lo-Fi Hip Hop';
    mood = 'Chill';
  } else if (lower.includes('synth') || lower.includes('retro') || lower.includes('80s')) {
    genre = 'Synthwave';
    mood = 'Groovy';
  } else if (lower.includes('ambient') || lower.includes('sleep') || lower.includes('focus')) {
    genre = 'Ambient';
    mood = 'Focus';
  } else if (lower.includes('rock') || lower.includes('indie')) {
    genre = 'Indie Rock';
    mood = 'Energetic';
  }

  return res.json({
    genre,
    mood,
    vibeSummary: 'Analyzed acoustic signature for local library integration.',
    suggestedBpm: 114,
  });
});

// Helper for international & multi-lingual song detection across native scripts & romanized tags
function detectInternationalMetadata(title?: string, artist?: string, album?: string, genre?: string): {
  language: string;
  culturalGenre: string;
} {
  const t = title || '';
  const a = artist || '';
  const alb = album || '';
  const g = genre || '';
  const combined = `${t} ${a} ${alb} ${g}`.toLowerCase();

  // 1. Script checks
  if (/[\u0B80-\u0BFF]/.test(t + a + alb)) {
    return { language: 'Tamil', culturalGenre: 'Tamil Cinema & Classical Melody' };
  }
  if (/[\u0900-\u097F]/.test(t + a + alb)) {
    return { language: 'Hindi', culturalGenre: 'Bollywood & Hindi Pop' };
  }
  if (/[\u0C00-\u0C7F]/.test(t + a + alb)) {
    return { language: 'Telugu', culturalGenre: 'Telugu Cinema Hits' };
  }
  if (/[\u0D00-\u0D7F]/.test(t + a + alb)) {
    return { language: 'Malayalam', culturalGenre: 'Malayalam Acoustic & Melodies' };
  }
  if (/[\u0A00-\u0A7F]/.test(t + a + alb)) {
    return { language: 'Punjabi', culturalGenre: 'Punjabi Bhangra & Hip-Hop' };
  }
  if (/[\uAC00-\uD7AF]/.test(t + a + alb)) {
    return { language: 'Korean', culturalGenre: 'K-Pop & Korean Waves' };
  }
  if (/[\u3040-\u30FF\u4E00-\u9FAF]/.test(t + a + alb)) {
    return { language: 'Japanese', culturalGenre: 'J-Pop & Anime Soundscapes' };
  }
  if (/[\u0600-\u06FF]/.test(t + a + alb)) {
    return { language: 'Arabic', culturalGenre: 'Arabic Pop & Tarab' };
  }

  // 2. Strict Tamil unambiguous keywords (Word boundaries \b prevent false matches on English words like master, beast, goat, gentleman, jeans)
  if (
    /\b(tamil|kollywood|masstamilan|starmusiq|isaimini|kuttyweb|tamiltunes|tamilwire|isaiminiweb|sensongs)\b/i.test(combined) ||
    /\b(anirudh|ilaiyaraaja|ilayaraja|harris jayaraj|santhosh narayanan|hiphop tamizha|sean roldan|gv prakash|g\.v\. prakash|vijay sethupathi|sivakarthikeyan|vetri maaran|pa ranjith|mari selvaraj|ponniyin selvan|enjoy enjami|rowdy baby|kannana kanne|kaavaalaa|arabic kuthu|halamithi habibo|kolaveri di|jimikki ponnu)\b/i.test(combined)
  ) {
    return { language: 'Tamil', culturalGenre: 'Tamil Cinema & Film Melodies' };
  }

  if (
    /hindi|bollywood|t-series|arijit|shreya ghoshal|pritam|atif aslam|kishore kumar|lata mangeshkar|badshah|mohit chauhan|sonu nigam|jubin nautiyal|amit trivedi|armaan malik|vishal|shekhar|sachin jigar|shankar ehsaan loy|rd burman|sd burman|gulzar|javed akhtar|neha kakkar|vishaal|alka yagnik|udit narayan|kumar sanu|shaan|kk|rekha bhardwaj|sunidhi chauhan|shashwat|sachet|parampara|jubin|king|raftaar|divine|mc stan|yoyo honey singh|honey singh/i.test(
      combined
    )
  ) {
    return { language: 'Hindi', culturalGenre: 'Bollywood & Hindi Melodies' };
  }

  if (/telugu|tollywood|dsp|thaman|devi sri prasad|keeravaani|chiranjeevi|allu arjun|mahesh babu|prabhas|ram charan|jr ntr|ntr|nani|vijay deverakonda|pawan kalyan|balakrishna|raviteja|nagarjuna|venkatesh|sid sriram telugu|aditya music|mango music/i.test(combined)) {
    return { language: 'Telugu', culturalGenre: 'Telugu Cinema Hits' };
  }

  if (/malayalam|mollywood|sushin shyam|gopi sundar|shaan rahman|vidyasagar|yesudas|ks chithra|vijay yesudas|vineeth sreenivasan|job kurian|hesam abdul wahab|sooraj santhosh|prithviraj|dulquer|fahadh|mohanlal|mammootty/i.test(combined)) {
    return { language: 'Malayalam', culturalGenre: 'Malayalam Acoustic & Melodies' };
  }

  if (/punjabi|sidhu moosewala|ap dhillon|diljit|karan aujla|gurdas|shubh|bhangra|amrit maan|jassie gill|hardy sandhu|parmish verma|guru randhawa|jasleen royal|mankirt|b praak|jaani|garry sandhu|bohemia/i.test(combined)) {
    return { language: 'Punjabi', culturalGenre: 'Punjabi Beats & Bhangra' };
  }

  if (/kpop|k-pop|bts|blackpink|newjeans|twice|stray kids|iu|exo|seventeen|taeyeon|enhypen|txt|red velvet|aespa|ive|le sserafim|ateez|itzy|nct|gidle|(g)i-dle|monsta x|shinee|got7|bigbang|super junior|girls generation|2ne1|psy|day6|woodz|bol4|heize|offonoff|krnb/i.test(combined)) {
    return { language: 'Korean', culturalGenre: 'K-Pop & Korean Waves' };
  }

  if (/j-pop|jpop|anime|yoasobi|kenshi yonezu|lisa|ado|radwimps|hige dandism|vocaloid|city pop|joe hisaishi|ghibli|aimer|king gnu|fujii kaze|utada hikaru|milet|eve|tatsuya kitani|eill|vaundy/i.test(combined)) {
    return { language: 'Japanese', culturalGenre: 'J-Pop & Anime Soundscapes' };
  }

  if (/bad bunny|rosal[ií]a|j balvin|daddy yankee|karol g|shakira|reggaeton|bachata|flamenco|cumbia|peso pluma|bizarrap|despacito|espanol|español|latino|anuel|maluma|ozuna|rauw alejandro|feid|myke towers|luis fonsi|ricky martin|enrique iglesias/i.test(combined)) {
    return { language: 'Spanish', culturalGenre: 'Latin Urbano & Reggaeton' };
  }

  if (/stromae|ang[eè]le|aya nakamura|daft punk|gims|chanson|fran[cç]ais|french|indila|louane/i.test(combined)) {
    return { language: 'French', culturalGenre: 'French Electro & Chanson' };
  }

  if (/burna boy|wizkid|rema|asake|davido|tiwa savage|tems|afrobeats|amapiano|fireboy/i.test(combined)) {
    return { language: 'African', culturalGenre: 'Afrobeats & Amapiano Groove' };
  }

  if (/anitta|alok|caetano veloso|bossa nova|sertanejo|funk carioca|portugu[eê]s|marisa monte/i.test(combined)) {
    return { language: 'Portuguese', culturalGenre: 'Bossa Nova & Brazilian Groove' };
  }

  // Fallback to existing genre
  return { language: 'English', culturalGenre: genre || 'Contemporary' };
}

// 5b. Smart Playlist Maker: Analyzes existing songs by genre and international/multilingual metadata
app.post('/api/ai/smart-playlist-maker', async (req: Request, res: Response) => {
  const { libraryTracks, mode, targetGenre, targetLanguage, customPrompt } = req.body;
  const tracks = Array.isArray(libraryTracks) ? libraryTracks : [];

  if (tracks.length === 0) {
    return res.json({ playlists: [] });
  }

  // Pre-annotate tracks with international heuristics to feed into AI
  const enrichedTracks = tracks.map((t: any) => {
    const meta = detectInternationalMetadata(t.title, t.artist, t.album, t.genre);
    return {
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      genre: t.genre,
      mood: t.mood,
      detectedLanguage: meta.language,
      detectedCulturalGenre: meta.culturalGenre,
    };
  });

  const promptText = (customPrompt || '').toLowerCase();
  const requestedLangMatch = promptText.match(/\b(tamil|hindi|telugu|malayalam|punjabi|korean|japanese|spanish|french|arabic|portuguese|english)\b/i) || (targetLanguage && targetLanguage !== 'All' ? [targetLanguage] : null);
  const requestedLanguage = requestedLangMatch ? requestedLangMatch[1].charAt(0).toUpperCase() + requestedLangMatch[1].slice(1).toLowerCase() : null;

  try {
    const prompt = `You are an expert musicologist and the Smart Playlist Maker for Vettify, an audiophile music player.
You must analyze the tracks currently available in the user's library and organize them into tailored smart playlists based on GENRE, ACOUSTIC ATMOSPHERE, and INTERNATIONAL / MULTILINGUAL analysis.

Target Mode: ${mode || 'auto-all'} (Allowed: 'by-genre', 'international', 'auto-all', 'custom')
Target Genre Filter: ${targetGenre || 'All genres'}
Target Language Filter: ${targetLanguage || 'All languages'}
Custom User Goal: ${customPrompt || 'None'}

Available Tracks in App Library:
${JSON.stringify(enrichedTracks, null, 2)}

CRITICAL RULES FOR ACCURACY AND FULL COVERAGE:
1. International Song Recognition:
   - Carefully recognize songs in different languages: Tamil, Hindi, Telugu, Malayalam, Punjabi, Korean (K-Pop), Japanese (J-Pop/Anime), Spanish (Latin/Reggaeton), French, Portuguese, Arabic, Afrobeats, etc.
   - Even if tracks have generic or messy tags (e.g. from Tamil music portals like Masstamilan or Starmusiq, or K-pop romanizations), identify their cultural roots, composer/artist lineage, and true musical genre.
2. FULL TRACK INCLUSION MANDATE:
   - If the user asks for "all" or "every" song matching a language (e.g. "Add all the tamil songs into one playlist"), you MUST include EVERY SINGLE track ID in the library that belongs to that language or category! Do NOT omit or limit the count to 1 or 2 tracks if there are more matching tracks in the library!
3. Playlist Construction:
   - If Custom User Goal is provided (e.g. "${customPrompt || ''}"): Fulfill the user's custom request precisely using ALL matching available tracks.
   - If mode is 'by-genre': Curate playlists strictly based on primary musical genres.
   - If mode is 'international': Curate playlists spotlighting international languages and regional music cultures.
   - If mode is 'auto-all': Provide a balanced mix of 3-5 smart playlists covering both prominent genres and international cultural styles present in the tracks.
4. Every playlist MUST ONLY reference 'id' values present in the library tracks.
5. Provide a captivating title, a 1-2 sentence curator description, genreCategory, languageCategory, culturalContext, and Tailwind gradient classes.

Return strictly valid JSON matching this schema:
{
  "playlists": [
    {
      "title": "string",
      "description": "string",
      "genreCategory": "string",
      "languageCategory": "string",
      "culturalContext": "string",
      "coverGradient": "string",
      "coverEmoji": "string",
      "selectedTrackIds": ["trackId1", "trackId2"]
    }
  ]
}
Return only JSON.`;

    const parsed = await generateWithGemini(prompt);
    if (parsed && Array.isArray(parsed.playlists) && parsed.playlists.length > 0) {
      // Validate track IDs exist
      let validPlaylists = parsed.playlists
        .map((p: any) => ({
          ...p,
          selectedTrackIds: (p.selectedTrackIds || []).filter((id: string) =>
            tracks.some((t: any) => t.id === id)
          ),
        }))
        .filter((p: any) => p.selectedTrackIds.length > 0);

      // Strict language verification filter: strip any track that does NOT match the playlist's language
      validPlaylists = validPlaylists.map((pl: any) => {
        const langCat = (pl.languageCategory || '').toLowerCase();
        const titleCat = (pl.title || '').toLowerCase();

        if (langCat.includes('tamil') || titleCat.includes('tamil')) {
          const strictTamilIds = pl.selectedTrackIds.filter((id: string) => {
            const tr = enrichedTracks.find((t: any) => t.id === id);
            return tr && tr.detectedLanguage === 'Tamil';
          });
          return {
            ...pl,
            languageCategory: 'Tamil',
            selectedTrackIds: strictTamilIds,
            description: `Curated collection containing ${strictTamilIds.length} Tamil songs from your library.`,
          };
        }
        return pl;
      }).filter((p: any) => p.selectedTrackIds.length > 0);

      // Post-processing guarantee: If user requested a specific language (e.g. Tamil), ensure ALL matching tracks in library are included!
      if (requestedLanguage) {
        const allMatchingIds = enrichedTracks
          .filter((t: any) => t.detectedLanguage?.toLowerCase() === requestedLanguage.toLowerCase())
          .map((t: any) => t.id);

        if (allMatchingIds.length > 0) {
          // Find or augment the matching playlist
          let langPlaylist = validPlaylists.find((p: any) =>
            p.languageCategory?.toLowerCase().includes(requestedLanguage.toLowerCase()) ||
            p.title?.toLowerCase().includes(requestedLanguage.toLowerCase())
          );

          if (langPlaylist) {
            // Combine and deduplicate
            const idSet = new Set([...langPlaylist.selectedTrackIds, ...allMatchingIds]);
            langPlaylist.selectedTrackIds = Array.from(idSet);
            langPlaylist.description = `Curated collection containing all ${langPlaylist.selectedTrackIds.length} ${requestedLanguage} songs in your library.`;
          } else {
            // Unshift dedicated full playlist
            validPlaylists.unshift({
              title: `The Complete ${requestedLanguage} Collection`,
              description: `A curated collection containing all ${allMatchingIds.length} ${requestedLanguage} tracks found in your library.`,
              genreCategory: `${requestedLanguage} Regional`,
              languageCategory: requestedLanguage,
              culturalContext: `Full regional showcase for ${requestedLanguage} music lovers.`,
              coverGradient: 'from-amber-600 via-rose-700 to-indigo-950',
              coverEmoji: requestedLanguage === 'Tamil' ? '🪕' : '🎵',
              selectedTrackIds: allMatchingIds,
            });
          }
        }
      }

      if (validPlaylists.length > 0) {
        return res.json({ playlists: validPlaylists });
      }
    }
  } catch (err) {
    console.warn('Smart playlist maker Gemini fallback triggered:', err);
  }

  // High-fidelity algorithmic fallback
  const playlists: any[] = [];
  const gradients = [
    'from-amber-600 via-rose-600 to-indigo-900',
    'from-cyan-600 via-blue-700 to-slate-900',
    'from-purple-600 via-pink-600 to-rose-900',
    'from-emerald-600 via-teal-700 to-zinc-900',
    'from-orange-600 via-amber-700 to-neutral-900',
    'from-fuchsia-600 via-indigo-700 to-slate-950',
  ];

  // Group by language
  const languageGroups: Record<string, string[]> = {};
  // Group by genre
  const genreGroups: Record<string, string[]> = {};

  enrichedTracks.forEach((t) => {
    // Language
    const lang = t.detectedLanguage || 'English';
    if (!languageGroups[lang]) languageGroups[lang] = [];
    languageGroups[lang].push(t.id);

    // Genre
    const g = t.genre || 'Soundtrack';
    if (!genreGroups[g]) genreGroups[g] = [];
    genreGroups[g].push(t.id);
  });

  let gradIdx = 0;

  // If user requested a specific language in custom prompt or targetLanguage, prioritize it first!
  if (requestedLanguage && languageGroups[requestedLanguage] && languageGroups[requestedLanguage].length > 0) {
    const ids = languageGroups[requestedLanguage];
    playlists.push({
      title: `The Complete ${requestedLanguage} Collection`,
      description: `Curated showcase of all ${ids.length} ${requestedLanguage} tracks found in your library.`,
      genreCategory: `${requestedLanguage} Regional`,
      languageCategory: requestedLanguage,
      culturalContext: `Traditional and modern ${requestedLanguage} recordings calibrated for audiophile dynamics.`,
      coverGradient: gradients[gradIdx % gradients.length],
      coverEmoji: requestedLanguage === 'Tamil' ? '🪕' : '🎵',
      selectedTrackIds: ids,
    });
    gradIdx++;
  }

  // If international mode or auto-all, create international playlists for non-English languages
  if (mode === 'international' || mode === 'auto-all' || mode === 'custom') {
    Object.entries(languageGroups).forEach(([lang, ids]) => {
      if (lang !== 'English' && ids.length > 0 && (!requestedLanguage || lang !== requestedLanguage)) {
        const sampleTrack = tracks.find((tr: any) => tr.id === ids[0]);
        const culturalGenre =
          sampleTrack?.culturalGenre ||
          (lang === 'Tamil' ? 'Tamil Cinema Melodies' : `${lang} Regional Music`);

        playlists.push({
          title: `${lang} Studio Selections: ${culturalGenre}`,
          description: `Curated showcase of ${ids.length} ${lang} tracks with authentic regional acoustic color and harmonic emotion.`,
          genreCategory: culturalGenre,
          languageCategory: lang,
          culturalContext: `Traditional and modern ${lang} acoustic arrangement calibrated for high-dynamic-range playback.`,
          coverGradient: gradients[gradIdx % gradients.length],
          coverEmoji: lang === 'Tamil' ? '🪕' : lang === 'Hindi' ? '🎵' : lang === 'Korean' ? '✨' : '🌍',
          selectedTrackIds: ids,
        });
        gradIdx++;
      }
    });
  }

  // Genre playlists
  if (mode === 'by-genre' || mode === 'auto-all' || playlists.length === 0) {
    Object.entries(genreGroups).forEach(([genreName, ids]) => {
      if (ids.length > 0) {
        playlists.push({
          title: `${genreName} Essentials Mix`,
          description: `Dynamic collection of ${ids.length} ${genreName} tracks engineered with punchy basslines and crisp transients.`,
          genreCategory: genreName,
          languageCategory: 'Multilingual',
          culturalContext: `Studio acoustic mastering for ${genreName} enthusiast listening.`,
          coverGradient: gradients[gradIdx % gradients.length],
          coverEmoji: '🎧',
          selectedTrackIds: ids,
        });
        gradIdx++;
      }
    });
  }

  // If user requested a specific genre
  if (targetGenre && targetGenre !== 'All') {
    const matching = tracks.filter(
      (t: any) =>
        t.genre?.toLowerCase().includes(targetGenre.toLowerCase()) ||
        t.culturalGenre?.toLowerCase().includes(targetGenre.toLowerCase())
    );
    if (matching.length > 0) {
      playlists.unshift({
        title: `${targetGenre} Studio Spotlight`,
        description: `Precision curated playlist featuring ${matching.length} ${targetGenre} records from your library.`,
        genreCategory: targetGenre,
        languageCategory: 'Curated',
        culturalContext: `Focused genre session with seamless acoustic pacing.`,
        coverGradient: 'from-orange-600 via-rose-700 to-zinc-950',
        coverEmoji: '🔥',
        selectedTrackIds: matching.map((t: any) => t.id),
      });
    }
  }

  return res.json({ playlists });
});

// 6. Cross-Device Cloud Audio Storage & Full Device Synchronization
// Audio uploaded from laptop/desktop persists on server and streams seamlessly to mobile phones!
app.post(
  '/api/cloud/upload',
  express.raw({ type: () => true, limit: '150mb' }),
  async (req: Request, res: Response) => {
    try {
      const buffer = req.body;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ error: 'No audio data received in upload payload' });
      }

      const rawFileName = req.headers['x-file-name'] ? decodeURIComponent(req.headers['x-file-name'] as string) : 'audio.mp3';
      const rawTitle = req.headers['x-title'] ? decodeURIComponent(req.headers['x-title'] as string) : '';
      const rawArtist = req.headers['x-artist'] ? decodeURIComponent(req.headers['x-artist'] as string) : '';
      const rawAlbum = req.headers['x-album'] ? decodeURIComponent(req.headers['x-album'] as string) : '';
      const rawDuration = parseFloat((req.headers['x-duration'] as string) || '180');
      const rawGenre = req.headers['x-genre'] ? decodeURIComponent(req.headers['x-genre'] as string) : 'Electronic';
      const rawMood = req.headers['x-mood'] ? decodeURIComponent(req.headers['x-mood'] as string) : 'Chill';
      const rawCoverUrl = req.headers['x-cover-url'] ? decodeURIComponent(req.headers['x-cover-url'] as string) : '';
      const rawFormat = (req.headers['x-format'] as string) || 'MP3';
      const requestedId = req.headers['x-track-id'] as string;

      const extMatch = rawFileName.match(/\.(mp3|wav|flac|m4a|ogg|aac|weba)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';

      const fileId = requestedId
        ? `cloud-${requestedId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
        : `cloud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const diskFileName = `${fileId}.${ext}`;
      const filePath = path.join(UPLOAD_DIR, diskFileName);

      await fs.promises.writeFile(filePath, buffer);

      const title = rawTitle || rawFileName.replace(/\.[^/.]+$/, '').trim();
      const artist = rawArtist || 'Cloud Artist';
      const album = rawAlbum || 'Cloud Uploads';

      // Automatically analyze international script and cultural genre
      const internationalMeta = detectInternationalMetadata(title, artist, album, rawGenre);

      const cloudTrack = {
        id: fileId,
        title,
        artist,
        album,
        duration: !isNaN(rawDuration) && rawDuration > 0 ? rawDuration : 180,
        genre: rawGenre,
        mood: rawMood,
        bpm: 118,
        format: rawFormat.toUpperCase(),
        bitrate: '320 kbps High-Fidelity',
        fileSize: buffer.length,
        coverUrl: rawCoverUrl || undefined,
        coverGradient: 'from-amber-600 via-rose-700 to-indigo-950',
        audioUrl: `/api/audio/${fileId}`,
        isLocal: false,
        isOfflineAvailable: true,
        isCloudSynced: true,
        uploadedAt: Date.now(),
        playCount: 0,
        liked: false,
        language: internationalMeta.language,
        culturalGenre: internationalMeta.culturalGenre,
      };

      // Add to server cloud library
      const existing = loadCloudTracks();
      const filtered = existing.filter((t: any) => t.id !== fileId);
      filtered.unshift(cloudTrack);
      saveCloudTracks(filtered);

      return res.json({
        success: true,
        track: cloudTrack,
        audioUrl: `/api/audio/${fileId}`,
        message: 'Audio track successfully synced to cloud and available on all devices!',
      });
    } catch (err: any) {
      console.error('Failed to process cloud audio upload:', err);
      return res.status(500).json({ error: err?.message || 'Failed to process audio upload' });
    }
  }
);

// Get all cloud-synced tracks (Phone calls this to display laptop/desktop uploads!)
app.get('/api/cloud/tracks', (_req: Request, res: Response) => {
  try {
    const tracks = loadCloudTracks();
    return res.json({ success: true, tracks });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load cloud tracks' });
  }
});

// Delete cloud track
app.delete('/api/cloud/tracks/:id', async (req: Request, res: Response) => {
  try {
    const trackId = req.params.id;
    const existing = loadCloudTracks();
    const target = existing.find((t: any) => t.id === trackId);
    const updated = existing.filter((t: any) => t.id !== trackId);
    saveCloudTracks(updated);

    if (target) {
      // Find and delete matching file on disk
      const files = await fs.promises.readdir(UPLOAD_DIR);
      for (const file of files) {
        if (file.startsWith(trackId)) {
          await fs.promises.unlink(path.join(UPLOAD_DIR, file)).catch(() => {});
        }
      }
    }

    return res.json({ success: true, deletedId: trackId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete cloud track' });
  }
});

// Stream audio with HTTP 206 Partial Content Range support for Mobile & Desktop
app.get('/api/audio/:fileId', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.fileId;
    const files = await fs.promises.readdir(UPLOAD_DIR);
    const targetFile = files.find((f) => f.startsWith(fileId));

    if (!targetFile) {
      return res.status(404).send('Audio file not found in cloud storage');
    }

    const filePath = path.join(UPLOAD_DIR, targetFile);
    const stat = await fs.promises.stat(filePath);
    const fileSize = stat.size;

    const ext = path.extname(targetFile).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.flac': 'audio/flac',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.weba': 'audio/webm',
    };
    const contentType = mimeTypes[ext] || 'audio/mpeg';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
        return;
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Origin, Content-Type, Accept',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Origin, Content-Type, Accept',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err: any) {
    console.error('Error streaming cloud audio:', err);
    res.status(500).send('Error streaming audio');
  }
});

// OPTIONS preflight for audio streaming and cloud endpoints
app.options(['/api/audio/:fileId', '/api/cloud/*'], (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Content-Type, Accept, x-file-name, x-title, x-artist, x-album, x-duration, x-genre, x-mood, x-cover-url, x-format, x-track-id');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  res.sendStatus(204);
});

// Full state synchronization (playlists, preferences, favorites, sync offsets)
app.post('/api/cloud/sync-state', (req: Request, res: Response) => {
  try {
    const { state } = req.body;
    if (!state) {
      return res.status(400).json({ error: 'State object required' });
    }
    saveCloudState({
      ...state,
      lastSyncedAt: Date.now(),
    });
    return res.json({ success: true, timestamp: Date.now() });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to save cloud sync state' });
  }
});

app.get('/api/cloud/sync-state', (_req: Request, res: Response) => {
  try {
    const state = loadCloudState();
    return res.json({ success: true, state });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load cloud sync state' });
  }
});

// Cloud Sync Backup & Restore with human codes
app.post('/api/sync/backup', (req: Request, res: Response) => {
  const { syncCode, profileData } = req.body;
  if (!syncCode || !profileData) {
    return res.status(400).json({ error: 'syncCode and profileData required' });
  }
  cloudSyncStore[syncCode.toUpperCase()] = {
    profile: profileData,
    timestamp: Date.now(),
  };
  return res.json({ success: true, syncCode: syncCode.toUpperCase(), timestamp: Date.now() });
});

app.get('/api/sync/restore/:code', (req: Request, res: Response) => {
  const code = req.params.code.toUpperCase();
  const entry = cloudSyncStore[code];
  if (!entry) {
    return res.status(404).json({ error: 'Sync code not found or expired' });
  }
  return res.json({ success: true, profile: entry.profile, timestamp: entry.timestamp });
});

// 6. Cover Art & Track Identification endpoint (searches iTunes IN/Global & Deezer)
app.get('/api/cover-art', async (req: Request, res: Response) => {
  const rawTitle = (req.query.title as string || '').trim();
  const rawArtist = (req.query.artist as string || '').trim();
  const rawAlbum = (req.query.album as string || '').trim();

  if (!rawTitle && !rawAlbum) {
    return res.status(400).json({ error: 'Title or album required' });
  }

  // Deep sanitizer for song titles and downloader watermarks
  const sanitize = (text: string) => {
    if (!text) return '';
    let s = text;
    // Remove bracketed website watermarks, rippers, or bitrates
    s = s.replace(/\[[^\]]*(?:masstamilan|starmusiq|isaimini|tamilwire|sensong|kuttyweb|mallumusic|atozmp3|naasong|pagalworld|mp3mad|hungama|gaana|jiosaavn|wynk|320\s*kbps|128\s*kbps|kbps|rip|official|audio|video|lyrics?|download)[^\]]*\]/gi, '');
    s = s.replace(/\([^)]*(?:masstamilan|starmusiq|isaimini|tamilwire|sensong|kuttyweb|mallumusic|atozmp3|naasong|pagalworld|mp3mad|hungama|gaana|jiosaavn|wynk|320\s*kbps|128\s*kbps|kbps|rip|official|audio|video|lyrics?|download)[^)]*\)/gi, '');
    // Standalone downloader domains or tags
    s = s.replace(/\b(?:masstamilan|starmusiq|isaimini|tamilwire|sensongsmp3?|kuttyweb|mallumusic|atozmp3|naasongs?|pagalworld|mp3mad)[a-z0-9._-]*\b/gi, '');
    s = s.replace(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|dev|in|so|net|org|co|info|cc|xyz|vip)\b/gi, '');
    s = s.replace(/\b\d{2,3}\s*k(?:bps)?\b/gi, '');
    // Common regional and junk tags
    s = s.replace(/\[(?:Tamil|Telugu|Hindi|Malayalam|Kannada)\]/gi, '');
    s = s.replace(/\((?:Tamil|Telugu|Hindi|Malayalam|Kannada)\)/gi, '');
    s = s.replace(/\.(mp3|flac|wav|m4a|aac|ogg)$/gi, '');
    // Leading track numbering like "01 - " or "378. "
    s = s.replace(/^\s*#?\d{1,4}(?:[.-]|\s+)\s*/, '');
    // Clean edge hyphens and excessive spacing
    s = s.replace(/\s*[-–—]\s*[-–—]\s*/g, ' - ');
    s = s.replace(/^[-–—:._|~/\s]+|[-–—:._|~/\s]+$/g, '');
    return s.replace(/\s{2,}/g, ' ').trim();
  };

  const cleanTitle = sanitize(rawTitle);
  const cleanAlbum = sanitize(rawAlbum);
  let cleanArtist = sanitize(rawArtist);

  // Filter out generic artist placeholders
  const isGenericArtist = !cleanArtist ||
    /^(unknown|local artist|device music|track artist|unknown artist|masstamilan|starmusiq|isaimini|tamilwire)$/i.test(cleanArtist);
  if (isGenericArtist) {
    cleanArtist = '';
  }

  // Helper to fetch JSON with timeout
  const fetchJson = async (url: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      });
      clearTimeout(timeout);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      clearTimeout(timeout);
      return null;
    }
  };

  // Build candidate search queries
  const candidateQueries: string[] = [];

  // If title has a separator (e.g. "Vaseegara - Minnale" or "Arabic Kuthu - Beast")
  if (cleanTitle.includes(' - ') || cleanTitle.includes(' – ')) {
    const parts = cleanTitle.split(/\s*[-–—]\s*/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      candidateQueries.push(`${parts[0]} ${parts[1]}`); // e.g. "Vaseegara Minnale"
      candidateQueries.push(`${parts[1]} ${parts[0]}`); // e.g. "Minnale Vaseegara"
      candidateQueries.push(parts[0]); // e.g. "Vaseegara"
      candidateQueries.push(parts[1]); // e.g. "Minnale"
    }
  }

  if (cleanTitle && cleanArtist) {
    candidateQueries.push(`${cleanArtist} ${cleanTitle}`);
    candidateQueries.push(`${cleanTitle} ${cleanArtist}`);
  }
  if (cleanTitle && cleanAlbum) {
    candidateQueries.push(`${cleanTitle} ${cleanAlbum}`);
  }
  if (cleanTitle) {
    candidateQueries.push(cleanTitle);
  }
  if (cleanAlbum && cleanArtist) {
    candidateQueries.push(`${cleanArtist} ${cleanAlbum}`);
  }
  if (cleanAlbum) {
    candidateQueries.push(cleanAlbum);
  }

  // Deduplicate queries
  const uniqueQueries = Array.from(new Set(candidateQueries.map(q => q.trim()).filter(q => q.length >= 2)));

  try {
    // Search iTunes in India region (country=IN, critical for Tamil and Indian songs) and global
    for (const q of uniqueQueries) {
      // 1. Try iTunes with country=IN first (covers Tamil/Indian movie soundtracks natively)
      const itunesInUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=3&country=IN`;
      const inData = await fetchJson(itunesInUrl);
      if (inData?.results?.length > 0) {
        for (const item of inData.results) {
          if (item.artworkUrl100) {
            const highRes = (item.artworkUrl100 as string).replace(/\/\d+x\d+bb\.(jpg|jpeg|png)/, '/1200x1200bb.jpg');
            return res.json({
              coverUrl: highRes,
              source: 'itunes-in',
              album: item.collectionName || cleanAlbum,
              artist: item.artistName || cleanArtist,
              title: item.trackName || cleanTitle,
              year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
            });
          }
        }
      }

      // 2. Try iTunes global (for English / international releases)
      const itunesGlobalUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=3`;
      const globalData = await fetchJson(itunesGlobalUrl);
      if (globalData?.results?.length > 0) {
        for (const item of globalData.results) {
          if (item.artworkUrl100) {
            const highRes = (item.artworkUrl100 as string).replace(/\/\d+x\d+bb\.(jpg|jpeg|png)/, '/1200x1200bb.jpg');
            return res.json({
              coverUrl: highRes,
              source: 'itunes-global',
              album: item.collectionName || cleanAlbum,
              artist: item.artistName || cleanArtist,
              title: item.trackName || cleanTitle,
              year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
            });
          }
        }
      }

      // 3. Try iTunes Album entity
      const itunesAlbumUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=1&country=IN`;
      const albumData = await fetchJson(itunesAlbumUrl);
      if (albumData?.results?.[0]?.artworkUrl100) {
        const item = albumData.results[0];
        const highRes = (item.artworkUrl100 as string).replace(/\/\d+x\d+bb\.(jpg|jpeg|png)/, '/1200x1200bb.jpg');
        return res.json({
          coverUrl: highRes,
          source: 'itunes-album',
          album: item.collectionName,
          artist: item.artistName || cleanArtist,
          title: cleanTitle || item.collectionName,
          year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
        });
      }

      // 4. Try Deezer Search API (worldwide official catalog, 1000x1000 cover_xl)
      const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=2`;
      const deezerData = await fetchJson(deezerUrl);
      if (deezerData?.data?.length > 0) {
        for (const item of deezerData.data) {
          const alb = item.album;
          const art = alb?.cover_xl || alb?.cover_big;
          if (art) {
            return res.json({
              coverUrl: art,
              source: 'deezer',
              album: alb.title || cleanAlbum,
              artist: item.artist?.name || cleanArtist,
              title: item.title || cleanTitle,
            });
          }
        }
      }
    }

    return res.json({ coverUrl: null, album: cleanAlbum, artist: cleanArtist, title: cleanTitle });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to search cover art' });
  }
});

function parseLrc(lrcText: string): { id: string; time: number; endTime: number; text: string }[] {
  if (!lrcText) return [];
  const rawLines = lrcText.split(/\r?\n/);
  const items: { time: number; text: string }[] = [];

  for (const line of rawLines) {
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)/);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseFloat(match[2]);
      const time = Math.max(0, mins * 60 + secs);
      const text = match[3].trim();
      if (text) {
        items.push({ time, text });
      }
    }
  }

  items.sort((a, b) => a.time - b.time);

  return items.map((item, idx) => {
    const next = items[idx + 1];
    const endTime = next ? next.time : item.time + 6;
    return {
      id: `lrc-${idx + 1}`,
      time: parseFloat(item.time.toFixed(2)),
      endTime: parseFloat(endTime.toFixed(2)),
      text: item.text,
    };
  });
}

// Direct Google & LrcLib Lyrics Search Engine with Google Search Grounding for English & International Songs
app.post('/api/lyrics/google-search', async (req: Request, res: Response) => {
  try {
    const { trackId, title, artist, duration = 180, language, customQuery } = req.body;
    if (!title && !customQuery) {
      return res.status(400).json({ error: 'Song title or search query is required' });
    }

    const sanitizedTitle = sanitizeSongTitleAndArtist(title || '');
    let sanitizedArtist = sanitizeSongTitleAndArtist(artist || '');
    if (/^(unknown|local artist|device music|track artist|unknown artist|masstamilan|starmusiq|isaimini|tamilwire)$/i.test(sanitizedArtist)) {
      sanitizedArtist = '';
    }

    const cleanTitle = sanitizedTitle || (title || '').trim();
    const cleanArtist = sanitizedArtist;
    const cleanQuery = customQuery
      ? customQuery.trim()
      : (cleanArtist ? `${cleanTitle} ${cleanArtist}` : cleanTitle).trim();

    // Helper for fetch with timeout
    const fetchJsonTimeout = async (url: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
        });
        clearTimeout(timeout);
        if (!response.ok) return null;
        return await response.json();
      } catch {
        clearTimeout(timeout);
        return null;
      }
    };

    // 1. Try LrcLib API for direct verified LRC synced lyrics
    try {
      let lrcData = null;
      if (cleanArtist && cleanTitle) {
        const lrcUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
        lrcData = await fetchJsonTimeout(lrcUrl);
      }

      if (!lrcData || (!lrcData.syncedLyrics && !lrcData.plainLyrics)) {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanQuery)}`;
        const searchResults = await fetchJsonTimeout(searchUrl);
        if (Array.isArray(searchResults) && searchResults.length > 0) {
          lrcData = searchResults.find((r: any) => r.syncedLyrics) || searchResults[0];
        }
      }

      if (!lrcData || (!lrcData.syncedLyrics && !lrcData.plainLyrics)) {
        const searchTitleUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`;
        const titleResults = await fetchJsonTimeout(searchTitleUrl);
        if (Array.isArray(titleResults) && titleResults.length > 0) {
          lrcData = titleResults.find((r: any) => r.syncedLyrics) || titleResults[0];
        }
      }

      if (lrcData && lrcData.syncedLyrics) {
        const parsedLines = parseLrc(lrcData.syncedLyrics);
        if (parsedLines.length > 0) {
          return res.json({
            success: true,
            lyrics: {
              trackId: trackId || `lrc-${Date.now()}`,
              title: lrcData.trackName || cleanTitle,
              artist: lrcData.artistName || cleanArtist,
              language: language || 'English',
              source: 'lrclib',
              googleSearchQuery: cleanQuery,
              searchCitation: 'LrcLib Synchronized LRC Catalog',
              isSynced: true,
              lines: parsedLines,
            },
          });
        }
      }

      if (lrcData && lrcData.plainLyrics) {
        const rawLines = lrcData.plainLyrics.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
        if (rawLines.length > 0) {
          const interval = Math.max(3, Math.min(8, duration / rawLines.length));
          const lines = rawLines.map((t: string, idx: number) => ({
            id: `plain-${idx + 1}`,
            time: parseFloat((idx * interval).toFixed(2)),
            endTime: parseFloat(((idx + 1) * interval).toFixed(2)),
            text: t,
          }));
          return res.json({
            success: true,
            lyrics: {
              trackId: trackId || `lrc-${Date.now()}`,
              title: lrcData.trackName || cleanTitle,
              artist: lrcData.artistName || cleanArtist,
              language: language || 'English',
              source: 'lrclib',
              googleSearchQuery: cleanQuery,
              searchCitation: 'LrcLib Plain Lyrics Catalog',
              isSynced: false,
              lines,
            },
          });
        }
      }
    } catch (lrcErr) {
      console.warn('LrcLib lyrics lookup error, continuing to Gemini Google Search:', lrcErr);
    }

    // 2. Try Gemini with Google Search Grounding using 'gemini-3.8-flash'
    const ai = getGenAI();
    if (ai) {
      try {
        const prompt = `You are Google's music lyrics search engine. Search Google directly for the official lyrics to the song:
Title: "${cleanTitle}"
Artist: "${cleanArtist}"
Duration: ${duration} seconds
Target Search Query: "${cleanQuery}"

Task:
Perform a Google Search for "${cleanQuery}".
Find the official, verified lyrics directly from Google search results (Genius, Musixmatch, Google knowledge graph).
This song may be in English or any international language (e.g. Tamil, Hindi, Korean, Japanese, Spanish, French, Punjabi, Arabic, etc.).

Return ONLY a valid JSON object inside a \`\`\`json code block:
{
  "trackId": "${trackId || ''}",
  "title": "${cleanTitle}",
  "artist": "${cleanArtist}",
  "language": "detected language",
  "detectedScript": "detected script",
  "source": "google",
  "searchCitation": "Google Search Grounded Lyrics",
  "isSynced": true,
  "lines": [
    {
      "time": 8.0,
      "endTime": 15.5,
      "text": "first line",
      "romanized": "romanized phonetics if non-latin script",
      "translation": "english meaning if non-english"
    }
  ]
}`;

        const LYRIC_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
        for (const model of LYRIC_MODELS) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                tools: [{ googleSearch: {} }],
              },
            });

            const parsed = safeParseJson(response.text);
            if (parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0) {
              const formattedLines = parsed.lines.map((l: any, idx: number) => ({
                id: `line-${idx + 1}`,
                time: Math.max(0, parseFloat(l.time) || (idx * 6)),
                endTime: l.endTime ? parseFloat(l.endTime) : (parseFloat(l.time) || (idx * 6)) + 5,
                text: String(l.text || '').trim(),
                romanized: l.romanized ? String(l.romanized).trim() : undefined,
                translation: l.translation ? String(l.translation).trim() : undefined,
              })).filter((l: any) => l.text.length > 0);

              if (formattedLines.length > 0) {
                let searchCitation = 'Google Search Verified Lyrics';
                const groundingMeta = (response.candidates?.[0] as any)?.groundingMetadata;
                if (groundingMeta?.webSearchQueries?.length) {
                  searchCitation = `Google Search: "${groundingMeta.webSearchQueries[0]}"`;
                }

                return res.json({
                  success: true,
                  lyrics: {
                    trackId: trackId || `search-${Date.now()}`,
                    title: parsed.title || cleanTitle,
                    artist: parsed.artist || cleanArtist,
                    language: parsed.language || language || 'Multilingual',
                    detectedScript: parsed.detectedScript,
                    source: 'google',
                    googleSearchQuery: cleanQuery,
                    searchCitation,
                    isSynced: true,
                    lines: formattedLines,
                  },
                });
              }
            }
          } catch (modelErr) {
            console.warn(`Model ${model} lyrics search failed, trying next:`, modelErr);
            continue;
          }
        }
      } catch (err) {
        console.warn('Google Search Grounding lyrics call error:', err);
      }
    }

    // 3. If no lyrics were found online, return source: 'not_found' (do not return fake baseline lyrics)
    return res.json({
      success: false,
      lyrics: {
        trackId: trackId || `track-${Date.now()}`,
        title: cleanTitle,
        artist: cleanArtist,
        language: language || 'English',
        source: 'not_found',
        searchCitation: 'No Online Lyrics Found',
        isSynced: false,
        lines: [],
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to fetch Google lyrics' });
  }
});

// Setup Vite in development or static serving in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vettify server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
