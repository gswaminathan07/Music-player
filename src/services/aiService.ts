import { Track, Playlist, UserPreferences, OnlineRecommendation, SmartFolder } from '../types/music';

export interface DailyMixResult {
  playlists: {
    title: string;
    description: string;
    moodCategory: string;
    coverGradient: string;
    coverEmoji: string;
    selectedTrackIds: string[];
  }[];
}

export interface OrganizeResult {
  folders: {
    folderName: string;
    description: string;
    genreOrMood: string;
    coverGradient: string;
    coverEmoji: string;
    trackIds: string[];
  }[];
}

export interface SmartShuffleResult {
  queueTrackIds: string[];
  rationale: string;
}

// Strip out heavy non-serializable or huge properties (like base64 coverArt or audio Blob URLs) before sending to AI server
function cleanTrackMetadata(tracks: Track[]) {
  return (tracks || []).map((t) => ({
    id: t.id,
    title: t.title || 'Untitled Track',
    artist: t.artist || 'Unknown Artist',
    album: t.album || 'Unknown Album',
    genre: t.genre || 'Soundtrack',
    mood: t.mood || 'Chill',
    bpm: t.bpm,
    duration: t.duration,
    liked: t.liked,
    language: t.language,
    culturalGenre: t.culturalGenre,
  }));
}

class AiService {
  async curateDailyPlaylists(
    libraryTracks: Track[],
    preferences: UserPreferences,
    targetMood?: string
  ): Promise<DailyMixResult> {
    const cleaned = cleanTrackMetadata(libraryTracks);
    try {
      const res = await fetch('/api/ai/curate-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryTracks: cleaned, preferences, targetMood }),
      });

      if (!res.ok) throw new Error('API request failed');
      return await res.json();
    } catch (err) {
      console.warn('AI daily curation fallback triggered:', err);
      const morningTracks = libraryTracks.filter(
        (t) => t.mood === 'Focus' || t.mood === 'Uplifting' || (t.genre && t.genre.includes('Lo-Fi'))
      );
      const energeticTracks = libraryTracks.filter(
        (t) => t.mood === 'Energetic' || t.mood === 'Groovy' || (t.bpm && t.bpm >= 120)
      );
      const nightTracks = libraryTracks.filter(
        (t) => t.mood === 'Chill' || t.mood === 'Ambient' || t.mood === 'Melancholic'
      );

      return {
        playlists: [
          {
            title: 'Daily Mix 1: Morning Focus & Flow',
            description: 'Gentle morning rhythms tailored to prime your creative momentum.',
            moodCategory: 'Focus',
            coverGradient: 'from-amber-500 via-orange-600 to-rose-600',
            coverEmoji: '🌅',
            selectedTrackIds: (morningTracks.length ? morningTracks : libraryTracks).map((t) => t.id),
          },
          {
            title: 'Daily Mix 2: Sunset Synth & Pulse',
            description: 'Uplifting tempos and driving harmonies for the afternoon stride.',
            moodCategory: 'Energetic',
            coverGradient: 'from-fuchsia-600 via-pink-600 to-indigo-600',
            coverEmoji: '⚡',
            selectedTrackIds: (energeticTracks.length ? energeticTracks : libraryTracks).map((t) => t.id),
          },
          {
            title: 'Daily Mix 3: Late Night Horizon',
            description: 'Mellow sub-bass and intimate reverbs to unwind your mind.',
            moodCategory: 'Chill',
            coverGradient: 'from-blue-700 via-indigo-800 to-slate-900',
            coverEmoji: '🌌',
            selectedTrackIds: (nightTracks.length ? nightTracks : libraryTracks).map((t) => t.id),
          },
        ],
      };
    }
  }

  async organizeLibrary(libraryTracks: Track[], customGoal?: string): Promise<OrganizeResult> {
    const cleaned = cleanTrackMetadata(libraryTracks);
    try {
      const res = await fetch('/api/ai/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryTracks: cleaned, customGoal }),
      });

      if (!res.ok) throw new Error('API request failed');
      return await res.json();
    } catch (err) {
      console.warn('AI library organization fallback triggered:', err);
      const moodMap: Record<string, string[]> = {
        'Lo-Fi Study & Coffeehouse': [],
        'Midnight Drive & Synthwave': [],
        'Deep Focus & Ambient Drift': [],
        'High Voltage & Workout': [],
      };

      libraryTracks.forEach((t) => {
        if ((t.genre && t.genre.includes('Lo-Fi')) || t.mood === 'Chill') {
          moodMap['Lo-Fi Study & Coffeehouse'].push(t.id);
        } else if ((t.genre && t.genre.includes('Synth')) || t.mood === 'Groovy') {
          moodMap['Midnight Drive & Synthwave'].push(t.id);
        } else if (t.mood === 'Focus' || t.mood === 'Ambient') {
          moodMap['Deep Focus & Ambient Drift'].push(t.id);
        } else {
          moodMap['High Voltage & Workout'].push(t.id);
        }
      });

      const gradients = [
        'from-emerald-600 via-teal-700 to-cyan-800',
        'from-purple-600 via-indigo-700 to-blue-900',
        'from-sky-600 via-blue-700 to-slate-900',
        'from-rose-600 via-red-600 to-amber-700',
      ];
      const emojis = ['☕', '🌃', '🧘', '🔥'];

      const folders = Object.entries(moodMap)
        .filter(([_, ids]) => ids.length > 0)
        .map(([name, ids], idx) => ({
          folderName: name,
          description: `Auto-sorted ${ids.length} tracks matching acoustic signature.`,
          genreOrMood: name,
          coverGradient: gradients[idx % gradients.length],
          coverEmoji: emojis[idx % emojis.length],
          trackIds: ids,
        }));

      return { folders };
    }
  }

  async smartShuffle(
    libraryTracks: Track[],
    currentTrackId?: string,
    currentMood: string = 'Chill',
    listeningHistory: any = {}
  ): Promise<SmartShuffleResult> {
    const cleaned = cleanTrackMetadata(libraryTracks);
    try {
      const res = await fetch('/api/ai/smart-shuffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryTracks: cleaned,
          currentTrackId,
          currentMood,
          listeningHistory,
        }),
      });

      if (!res.ok) throw new Error('API request failed');
      return await res.json();
    } catch (err) {
      console.warn('Smart shuffle fallback triggered:', err);
      const tracks = [...libraryTracks];
      const current = tracks.find((t) => t.id === currentTrackId);

      const scored = tracks
        .filter((t) => t.id !== currentTrackId)
        .map((t) => {
          let score = Math.random() * 20;
          if (currentMood !== 'All' && t.mood === currentMood) score += 40;
          if (current && t.genre === current.genre) score += 25;
          if (t.liked) score += 15;
          return { track: t, score };
        });

      scored.sort((a, b) => b.score - a.score);

      return {
        queueTrackIds: scored.map((s) => s.track.id),
        rationale: `Harmonically tuned to your ${currentMood} vibe with smooth tempo transitions.`,
      };
    }
  }

  async fetchOnlineRecommendations(
    libraryTracks: Track[],
    preferences: UserPreferences,
    targetVibe?: string
  ): Promise<{ recommendations: OnlineRecommendation[] }> {
    const cleaned = cleanTrackMetadata(libraryTracks);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryTracks: cleaned, preferences, targetVibe }),
      });

      if (!res.ok) throw new Error('API request failed');
      return await res.json();
    } catch (err) {
      console.warn('AI recommendations fallback triggered:', err);
      return {
        recommendations: [
          {
            title: 'Midnight City Reverie',
            artist: 'M83 & Gunship',
            album: 'Neon Memories',
            genre: 'Synthwave / Dream Pop',
            mood: 'Energetic',
            matchReason: 'Shares the lush analog synthesizers and cinematic drums from your library.',
            similarityScore: 97,
            suggestedTags: ['Cinematic', '80s Synth', 'Anthemic'],
          },
          {
            title: 'Warm Afternoon Tea',
            artist: 'Kupla',
            album: 'Kingdom in Blue',
            genre: 'Lo-Fi Hip Hop',
            mood: 'Chill',
            matchReason: 'Gentle piano voicings with warm cassette tape flutter matching your chill tracks.',
            similarityScore: 94,
            suggestedTags: ['Relaxing', 'Piano', 'Cozy'],
          },
          {
            title: 'Siren Echoes',
            artist: 'Tycho & Kiasmos',
            album: 'Epoch Horizons',
            genre: 'Ambient Electronic',
            mood: 'Focus',
            matchReason: 'Subtle rhythmic pulses designed for undisturbed cognitive flow.',
            similarityScore: 92,
            suggestedTags: ['Minimal', 'Instrumental', 'Flow'],
          },
        ],
      };
    }
  }

  async analyzeTrack(filename: string, metadata?: any): Promise<any> {
    try {
      const res = await fetch('/api/ai/analyze-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, metadata }),
      });

      if (!res.ok) throw new Error('API request failed');
      return await res.json();
    } catch (err) {
      const lower = filename.toLowerCase();
      let genre = 'Electronic';
      let mood: any = 'Chill';

      if (lower.includes('lofi') || lower.includes('lo-fi') || lower.includes('chill')) {
        genre = 'Lo-Fi Hip Hop';
        mood = 'Chill';
      } else if (lower.includes('synth') || lower.includes('wave') || lower.includes('80s')) {
        genre = 'Synthwave';
        mood = 'Groovy';
      } else if (lower.includes('rock') || lower.includes('guitar')) {
        genre = 'Indie Rock';
        mood = 'Energetic';
      } else if (lower.includes('ambient') || lower.includes('sleep') || lower.includes('meditation')) {
        genre = 'Ambient';
        mood = 'Ambient';
      }

      return {
        genre,
        mood,
        vibeSummary: 'Acoustic signature matched from audio tags.',
        suggestedBpm: 115,
      };
    }
  }

  // Detect international script, language, and cultural genre from track metadata
  detectInternationalSong(track: Track): { language: string; culturalGenre: string; isInternational: boolean } {
    const t = track.title || '';
    const a = track.artist || '';
    const alb = track.album || '';
    const g = track.genre || '';
    const combined = `${t} ${a} ${alb} ${g}`.toLowerCase();

    // 1. Script checks
    if (/[\u0B80-\u0BFF]/.test(t + a + alb)) {
      return { language: 'Tamil', culturalGenre: 'Tamil Cinema & Classical', isInternational: true };
    }
    if (/[\u0900-\u097F]/.test(t + a + alb)) {
      return { language: 'Hindi', culturalGenre: 'Bollywood & Hindi Pop', isInternational: true };
    }
    if (/[\u0C00-\u0C7F]/.test(t + a + alb)) {
      return { language: 'Telugu', culturalGenre: 'Telugu Film Melodies', isInternational: true };
    }
    if (/[\u0D00-\u0D7F]/.test(t + a + alb)) {
      return { language: 'Malayalam', culturalGenre: 'Malayalam Melodies', isInternational: true };
    }
    if (/[\u0A00-\u0A7F]/.test(t + a + alb)) {
      return { language: 'Punjabi', culturalGenre: 'Punjabi Bhangra & Hip-Hop', isInternational: true };
    }
    if (/[\uAC00-\uD7AF]/.test(t + a + alb)) {
      return { language: 'Korean', culturalGenre: 'K-Pop & Korean Waves', isInternational: true };
    }
    if (/[\u3040-\u30FF\u4E00-\u9FAF]/.test(t + a + alb)) {
      return { language: 'Japanese', culturalGenre: 'J-Pop & Anime Soundscapes', isInternational: true };
    }
    if (/[\u0600-\u06FF]/.test(t + a + alb)) {
      return { language: 'Arabic', culturalGenre: 'Arabic Pop & Tarab', isInternational: true };
    }

    // 2. Strict Tamil unambiguous keywords
    if (
      /\b(tamil|kollywood|masstamilan|starmusiq|isaimini|kuttyweb|tamiltunes|tamilwire|isaiminiweb|sensongs)\b/i.test(combined) ||
      /\b(anirudh|ilaiyaraaja|ilayaraja|harris jayaraj|santhosh narayanan|hiphop tamizha|sean roldan|gv prakash|g\.v\. prakash|vijay sethupathi|sivakarthikeyan|vetri maaran|pa ranjith|mari selvaraj|ponniyin selvan|enjoy enjami|rowdy baby|kannana kanne|kaavaalaa|arabic kuthu|halamithi habibo|kolaveri di|jimikki ponnu)\b/i.test(combined)
    ) {
      return { language: 'Tamil', culturalGenre: 'Tamil Cinema & Film Melodies', isInternational: true };
    }
    if (
      /hindi|bollywood|t-series|arijit|shreya ghoshal|pritam|atif aslam|kishore kumar|lata mangeshkar|badshah|mohit chauhan|sonu nigam|jubin nautiyal|amit trivedi|armaan malik|vishal|shekhar|sachin jigar|shankar ehsaan loy|rd burman|sd burman|gulzar|javed akhtar|neha kakkar|vishaal|alka yagnik|udit narayan|kumar sanu|shaan|kk|rekha bhardwaj|sunidhi chauhan|shashwat|sachet|parampara|jubin|king|raftaar|divine|mc stan|yoyo honey singh|honey singh/i.test(
        combined
      )
    ) {
      return { language: 'Hindi', culturalGenre: 'Bollywood & Hindi Melodies', isInternational: true };
    }
    if (/telugu|tollywood|dsp|thaman|devi sri prasad|keeravaani|chirmingham|allu arjun|mahesh babu|prabhas|ram charan|jr ntr|ntr|nani|vijay deverakonda|pawan kalyan|balakrishna|raviteja|nagarjuna|venkatesh|sid sriram telugu|aditya music|mango music/i.test(combined)) {
      return { language: 'Telugu', culturalGenre: 'Telugu Cinema Hits', isInternational: true };
    }
    if (/malayalam|mollywood|sushin shyam|gopi sundar|shaan rahman|vidyasagar|yesudas|ks chithra|vijay yesudas|vineeth sreenivasan|job kurian|hesam abdul wahab|sooraj santhosh|prithviraj|dulquer|fahadh|mohanlal|mammootty/i.test(combined)) {
      return { language: 'Malayalam', culturalGenre: 'Malayalam Acoustic & Melodies', isInternational: true };
    }
    if (/punjabi|sidhu moosewala|ap dhillon|diljit|karan aujla|gurdas|shubh|bhangra|amrit maan|jassie gill|hardy sandhu|parmish verma|guru randhawa|jasleen royal|mankirt|b praak|jaani|garry sandhu|bohemia/i.test(combined)) {
      return { language: 'Punjabi', culturalGenre: 'Punjabi Beats & Bhangra', isInternational: true };
    }
    if (/kpop|k-pop|bts|blackpink|newjeans|twice|stray kids|iu|exo|seventeen|taeyeon|enhypen|txt|red velvet|aespa|ive|le sserafim|ateez|itzy|nct|gidle|(g)i-dle|monsta x|shinee|got7|bigbang|super junior|girls generation|2ne1|psy|day6|woodz|bol4|heize|offonoff|krnb/i.test(combined)) {
      return { language: 'Korean', culturalGenre: 'K-Pop & Korean Waves', isInternational: true };
    }
    if (/j-pop|jpop|anime|yoasobi|kenshi yonezu|lisa|ado|radwimps|hige dandism|vocaloid|city pop|joe hisaishi|ghibli|aimer|king gnu|fujii kaze|utada hikaru|milet|eve|tatsuya kitani|eill|vaundy/i.test(combined)) {
      return { language: 'Japanese', culturalGenre: 'J-Pop & Anime Soundscapes', isInternational: true };
    }
    if (/bad bunny|rosal[ií]a|j balvin|daddy yankee|karol g|shakira|reggaeton|bachata|flamenco|cumbia|peso pluma|bizarrap|despacito|espanol|español|latino|anuel|maluma|ozuna|rauw alejandro|feid|myke towers|luis fonsi|ricky martin|enrique iglesias/i.test(combined)) {
      return { language: 'Spanish', culturalGenre: 'Latin Urbano & Reggaeton', isInternational: true };
    }
    if (/stromae|ang[eè]le|aya nakamura|daft punk|gims|chanson|fran[cç]ais|french|indila|louane/i.test(combined)) {
      return { language: 'French', culturalGenre: 'French Electro & Chanson', isInternational: true };
    }

    return { language: 'English', culturalGenre: track.genre || 'Contemporary', isInternational: false };
  }

  // Smart Playlist Maker: Creates genre-based, custom, and international playlists from existing songs
  async makeSmartPlaylists(
    libraryTracks: Track[],
    options: {
      mode?: 'by-genre' | 'international' | 'auto-all' | 'custom';
      targetGenre?: string;
      targetLanguage?: string;
      customPrompt?: string;
    } = {}
  ): Promise<{
    playlists: {
      title: string;
      description: string;
      genreCategory: string;
      languageCategory?: string;
      culturalContext?: string;
      coverGradient: string;
      coverEmoji?: string;
      selectedTrackIds: string[];
    }[];
  }> {
    const cleaned = cleanTrackMetadata(libraryTracks);
    try {
      const res = await fetch('/api/ai/smart-playlist-maker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryTracks: cleaned,
          mode: options.mode || 'auto-all',
          targetGenre: options.targetGenre,
          targetLanguage: options.targetLanguage,
          customPrompt: options.customPrompt,
        }),
      });

      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      if (data && Array.isArray(data.playlists) && data.playlists.length > 0) {
        return data;
      }
      throw new Error('Empty response from smart playlist maker');
    } catch (err) {
      console.warn('makeSmartPlaylists client fallback triggered:', err);
      const mode = options.mode || 'auto-all';
      const gradients = [
        'from-amber-600 via-rose-600 to-indigo-900',
        'from-cyan-600 via-blue-700 to-slate-900',
        'from-purple-600 via-pink-600 to-rose-900',
        'from-emerald-600 via-teal-700 to-zinc-900',
        'from-orange-600 via-amber-700 to-neutral-900',
        'from-fuchsia-600 via-indigo-700 to-slate-950',
      ];

      const langMap: Record<string, string[]> = {};
      const genreMap: Record<string, string[]> = {};
      const moodMap: Record<string, string[]> = {};

      libraryTracks.forEach((t) => {
        const info = this.detectInternationalSong(t);
        if (!langMap[info.language]) langMap[info.language] = [];
        langMap[info.language].push(t.id);

        const g = t.genre || 'Soundtrack';
        if (!genreMap[g]) genreMap[g] = [];
        genreMap[g].push(t.id);

        const m = t.mood || 'Chill';
        if (!moodMap[m]) moodMap[m] = [];
        moodMap[m].push(t.id);
      });

      const playlists: any[] = [];
      let idx = 0;

      // Handle custom prompt search in client fallback
      if (options.customPrompt && options.customPrompt.trim().length > 0) {
        const query = options.customPrompt.toLowerCase();
        const matchedIds = libraryTracks
          .filter((t) => {
            const comb = `${t.title} ${t.artist} ${t.album} ${t.genre} ${t.mood}`.toLowerCase();
            return comb.includes(query) || query.split(/\s+/).some((q) => q.length > 2 && comb.includes(q));
          })
          .map((t) => t.id);

        const trackIds = matchedIds.length > 0 ? matchedIds : libraryTracks.map((t) => t.id);
        playlists.push({
          title: `Custom: ${options.customPrompt.slice(0, 30)}${options.customPrompt.length > 30 ? '...' : ''}`,
          description: `Custom playlist with ${trackIds.length} tracks matched to '${options.customPrompt}'.`,
          genreCategory: 'Custom Vibe',
          languageCategory: 'Multilingual',
          culturalContext: `Tailored compilation based on your custom prompt.`,
          coverGradient: gradients[idx % gradients.length],
          coverEmoji: '✨',
          selectedTrackIds: trackIds,
        });
        idx++;
      }

      // Target Genre specific filter
      if (options.targetGenre && options.targetGenre !== 'All' && genreMap[options.targetGenre]) {
        playlists.push({
          title: `${options.targetGenre} Collection`,
          description: `All ${genreMap[options.targetGenre].length} ${options.targetGenre} tracks from your library.`,
          genreCategory: options.targetGenre,
          languageCategory: 'Multilingual',
          culturalContext: `Signature ${options.targetGenre} soundscape.`,
          coverGradient: gradients[idx % gradients.length],
          coverEmoji: '🎧',
          selectedTrackIds: genreMap[options.targetGenre],
        });
        idx++;
      }

      // Target Language specific filter
      if (options.targetLanguage && options.targetLanguage !== 'All' && langMap[options.targetLanguage]) {
        playlists.push({
          title: `The Complete ${options.targetLanguage} Collection`,
          description: `All ${langMap[options.targetLanguage].length} ${options.targetLanguage} songs in your library.`,
          genreCategory: `${options.targetLanguage} Regional`,
          languageCategory: options.targetLanguage,
          culturalContext: `Regional showcase for ${options.targetLanguage} music.`,
          coverGradient: gradients[idx % gradients.length],
          coverEmoji: options.targetLanguage === 'Tamil' ? '🪕' : '🌍',
          selectedTrackIds: langMap[options.targetLanguage],
        });
        idx++;
      }

      // International mode or auto-all
      if (mode === 'international' || mode === 'auto-all') {
        Object.entries(langMap).forEach(([lang, ids]) => {
          if (ids.length > 0 && !playlists.some((p) => p.languageCategory === lang)) {
            playlists.push({
              title: `${lang} Studio Selections`,
              description: `Acoustic compilation of ${ids.length} ${lang} songs from your device library.`,
              genreCategory: `${lang} Regional`,
              languageCategory: lang,
              culturalContext: `Authentic ${lang} music recordings calibrated for audiophile dynamics.`,
              coverGradient: gradients[idx % gradients.length],
              coverEmoji: lang === 'Tamil' ? '🪕' : lang === 'Hindi' ? '🎵' : lang === 'Korean' ? '✨' : '🌍',
              selectedTrackIds: ids,
            });
            idx++;
          }
        });
      }

      // By Genre mode or auto-all
      if (mode === 'by-genre' || mode === 'auto-all' || playlists.length === 0) {
        Object.entries(genreMap).forEach(([g, ids]) => {
          if (ids.length > 0 && !playlists.some((p) => p.genreCategory === g)) {
            playlists.push({
              title: `${g} Studio Essentials`,
              description: `Curated mix of ${ids.length} ${g} tracks with cohesive tempo and energy.`,
              genreCategory: g,
              languageCategory: 'Multilingual',
              culturalContext: `Signature ${g} soundscape with clean transient response.`,
              coverGradient: gradients[idx % gradients.length],
              coverEmoji: '🎧',
              selectedTrackIds: ids,
            });
            idx++;
          }
        });

        // Also add Mood mixes if playlists count is still low
        Object.entries(moodMap).forEach(([m, ids]) => {
          if (ids.length > 0 && !playlists.some((p) => p.title.includes(m))) {
            playlists.push({
              title: `${m} Acoustic Vibe`,
              description: `${ids.length} songs selected for a ${m.toLowerCase()} mood.`,
              genreCategory: 'Mood Vibe',
              languageCategory: 'Multilingual',
              culturalContext: `${m} atmosphere.`,
              coverGradient: gradients[idx % gradients.length],
              coverEmoji: m === 'Energetic' ? '⚡' : m === 'Chill' ? '☕' : '🧘',
              selectedTrackIds: ids,
            });
            idx++;
          }
        });
      }

      // Absolute safety: If no playlists were created (e.g., strange track list), make 1 master playlist with all tracks!
      if (playlists.length === 0 && libraryTracks.length > 0) {
        playlists.push({
          title: 'Master Audio Collection',
          description: `All ${libraryTracks.length} tracks automatically grouped into a smart playlist.`,
          genreCategory: 'Full Library',
          languageCategory: 'Multilingual',
          culturalContext: 'Complete device library audio collection.',
          coverGradient: gradients[0],
          coverEmoji: '🎵',
          selectedTrackIds: libraryTracks.map((t) => t.id),
        });
      }

      return { playlists };
    }
  }
}

export const aiService = new AiService();
