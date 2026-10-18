import React, { useState, useEffect } from 'react';
import {
  Track,
  Playlist,
  SmartFolder,
  UserPreferences,
  EqualizerSettings,
  ListeningStats,
  TrackMood,
} from './types/music';
import {
  DEFAULT_TRACKS,
  DEFAULT_PLAYLISTS,
  DEFAULT_FOLDERS,
  COMMUNITY_CURATORS,
  INITIAL_PREFERENCES,
  INITIAL_EQUALIZER,
} from './data/defaultTracks';
import { audioEngine } from './services/audioEngine';
import { offlineStorage } from './services/offlineStorage';
import { aiService } from './services/aiService';
import { cloudSyncService } from './services/cloudSyncService';
import { AudioVisualizer } from './components/AudioVisualizer';
import { MiniPlayer } from './components/MiniPlayer';
import { FullScreenPlayer } from './components/FullScreenPlayer';
import { EqualizerDrawer } from './components/EqualizerDrawer';
import { FileUploadModal } from './components/FileUploadModal';
import { AiCuratorModal } from './components/AiCuratorModal';
import { SocialShareModal } from './components/SocialShareModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { PixelTurntableWidget } from './components/PixelTurntableWidget';
import { SettingsModal } from './components/SettingsModal';
import { SmartPlaylistMakerModal } from './components/SmartPlaylistMakerModal';
import { KaraokeLyricsBar } from './components/KaraokeLyricsBar';
import {
  Play,
  Pause,
  Cloud,
  Sliders,
  Share2,
  Heart,
  FolderOpen,
  Search,
  Disc3,
  Shuffle,
  ChevronRight,
  HardDrive,
  Settings,
  ListMusic,
  Music,
  Sparkles,
  Wand2,
  Activity,
  SkipBack,
  SkipForward,
  Globe,
  FolderPlus,
  Layers,
  RefreshCw,
  Laptop,
  Smartphone,
  Mic2,
  Sun,
  Moon,
} from 'lucide-react';
import { sanitizeTrack } from './utils/trackFormatter';
import { readAudioTags } from './services/audioTagReader';
import { fetchCoverArtForTrack, identifyTrackOnline } from './services/coverArtService';

export default function App() {
  // App Core State
  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  const [playlists, setPlaylists] = useState<Playlist[]>(DEFAULT_PLAYLISTS);
  const [folders, setFolders] = useState<SmartFolder[]>(DEFAULT_FOLDERS);
  const [preferences, setPreferences] = useState<UserPreferences>(INITIAL_PREFERENCES);
  const [equalizer, setEqualizer] = useState<EqualizerSettings>(INITIAL_EQUALIZER);
  const [stats, setStats] = useState<ListeningStats>({
    totalPlays: 72,
    totalMinutesListened: 184,
    likedCount: 3,
    genreBreakdown: { Electronic: 28, Ambient: 22, Acoustic: 19 },
    moodBreakdown: { Chill: 34, Focus: 22, Energetic: 16 },
  });

  // Audio Playback State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(DEFAULT_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(75);
  const [progress, setProgress] = useState<number>(0);
  const [queue, setQueue] = useState<Track[]>(DEFAULT_TRACKS);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  // History stack for genuine 'Play Previous' behavior (stores played track IDs in chronological order)
  const [playHistory, setPlayHistory] = useState<string[]>([]);
  const isNavigatingHistoryRef = React.useRef(false);
  const handleNextTrackRef = React.useRef<() => void>(() => {});
  const handlePrevTrackRef = React.useRef<() => void>(() => {});
  // Smart Shuffle State
  const [isSmartShuffleActive, setIsSmartShuffleActive] = useState<boolean>(false);
  const [currentMood, setCurrentMood] = useState<TrackMood | 'All'>('Chill');
  const [smartShuffleRationale, setSmartShuffleRationale] = useState<string>(
    'Harmonically ordered for balanced listening energy.'
  );

  const currentTrackRef = React.useRef<Track | null>(currentTrack);
  const queueRef = React.useRef<Track[]>(queue);
  const tracksRef = React.useRef<Track[]>(tracks);
  const repeatModeRef = React.useRef(repeatMode);
  const isSmartShuffleActiveRef = React.useRef(isSmartShuffleActive);

  currentTrackRef.current = currentTrack;
  queueRef.current = queue;
  tracksRef.current = tracks;
  repeatModeRef.current = repeatMode;
  isSmartShuffleActiveRef.current = isSmartShuffleActive;

  const [meterDb, setMeterDb] = useState<string>('-∞ dB');

  useEffect(() => {
    if (!isPlaying) {
      setMeterDb('-∞ dB');
      return;
    }
    let animId: number;
    const updateLoop = () => {
      // 60-120 FPS native frame rate loop for silky smooth analog meter ballistics
      setMeterDb(audioEngine.getPeakLevelDb().formattedDb);
      animId = requestAnimationFrame(updateLoop);
    };
    animId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // Studio Theme & Accessibility
  const isLightMode = preferences.theme === 'light';

  useEffect(() => {
    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('vettify_theme') : null;
    if (storedTheme && (storedTheme === 'light' || storedTheme === 'dark-oled')) {
      setPreferences((prev) => ({ ...prev, theme: storedTheme as any }));
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('light-theme', isLightMode);
    }
  }, [isLightMode]);

  const handleToggleTheme = () => {
    const nextTheme: UserPreferences['theme'] = isLightMode ? 'dark-oled' : 'light';
    const newPrefs: UserPreferences = { ...preferences, theme: nextTheme };
    setPreferences(newPrefs);
    offlineStorage.setKV('user_preferences', newPrefs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vettify_theme', nextTheme);
    }
  };

  // UI Navigation & Modals
  const [activeNav, setActiveNav] = useState<'library' | 'deck' | 'equalizer' | 'collections'>('library');
  const [librarySubTab, setLibrarySubTab] = useState<'all' | 'folders' | 'playlists'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenreFilter, setSelectedGenreFilter] = useState<string>('All');

  // Modals visibility
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [isEqOpen, setIsEqOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAiCuratorOpen, setIsAiCuratorOpen] = useState(false);
  const [isSmartPlaylistMakerOpen, setIsSmartPlaylistMakerOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedPlaylistForShare, setSelectedPlaylistForShare] = useState<Playlist | null>(null);

  // Cloud Sync state across laptop & phone
  const [cloudTracksCount, setCloudTracksCount] = useState<number>(0);
  const [isSyncingWithCloud, setIsSyncingWithCloud] = useState<boolean>(false);

  // Floating widget states
  const [isFloatingWidgetActive, setIsFloatingWidgetActive] = useState(false);
  const [activeWidgetStyle, setActiveWidgetStyle] = useState<'turntable' | 'notification' | 'samsung'>('turntable');

  // Initialize Audio Blobs & IndexedDB cache on first mount
  useEffect(() => {
    const initApp = async () => {
      const storedTracks = await offlineStorage.getAllTracks();
      const storedPlaylists = await offlineStorage.getAllPlaylists();
      const storedFolders = await offlineStorage.getAllFolders();
      const storedPrefs = await offlineStorage.getKV<UserPreferences>('user_preferences');
      const storedEq = await offlineStorage.getKV<EqualizerSettings>('equalizer_settings');

      if (storedPrefs) setPreferences(storedPrefs);
      if (storedEq) {
        setEqualizer(storedEq);
        audioEngine.applyEqualizer(storedEq);
      }

      if (storedPlaylists.length > 0) setPlaylists(storedPlaylists);
      if (storedFolders.length > 0) setFolders(storedFolders);

      // Re-hydrate audio URLs for offline tracks & sanitize track metadata
      // ALWAYS generate fresh Object URLs because browser revokes previous session URLs on reload!
      let metadataMigrated = false;
      const sanitizedStoredTracks: Track[] = [];

      for (const rawTrack of storedTracks) {
        let t = sanitizeTrack(rawTrack);

        if (t.isLocal || t.blobId) {
          const blob = await offlineStorage.getAudioBlob(t.blobId || t.id);
          if (blob) {
            t.audioUrl = URL.createObjectURL(blob);

            // If artist was unresolved or default, extract embedded ID3 tags from file blob
            if (
              !t.artist ||
              t.artist === 'Local Artist' ||
              t.artist === 'Unknown Artist' ||
              t.artist === 'Device Music' ||
              t.title.includes(';')
            ) {
              const tags = await readAudioTags(blob).catch(() => null);
              if (tags) {
                if (tags.title) t.title = tags.title;
                if (tags.artist) t.artist = tags.artist;
                if (tags.album && (!t.album || t.album === 'Device Music')) t.album = tags.album;
                if (tags.genre && (!t.genre || t.genre === 'Electronic')) t.genre = tags.genre;
                if (tags.coverUrl && !t.coverUrl) t.coverUrl = tags.coverUrl;
                t = sanitizeTrack(t);
              }
            }
          }
        }
        if (!t.audioUrl) {
          const vibe = t.genre.toLowerCase().includes('synth')
            ? 'synthwave'
            : t.genre.toLowerCase().includes('ambient')
            ? 'ambient'
            : 'lofi';
          t.audioUrl = audioEngine.getProceduralTrackUrl(vibe);
        }

        if (t.title !== rawTrack.title || t.artist !== rawTrack.artist) {
          metadataMigrated = true;
        }

        sanitizedStoredTracks.push(t);
      }

      if (metadataMigrated && sanitizedStoredTracks.length > 0) {
        offlineStorage.saveTracks(sanitizedStoredTracks).catch(() => {});
      }

      let activeTracks = sanitizedStoredTracks;
      if (activeTracks.length === 0) {
        // Provide rich studio demo tracks so user can test and play immediately on install!
        activeTracks = DEFAULT_TRACKS.map((t) => {
          const vibe = t.genre.toLowerCase().includes('synth')
            ? 'synthwave'
            : t.genre.toLowerCase().includes('ambient')
            ? 'ambient'
            : 'lofi';
          return {
            ...t,
            audioUrl: audioEngine.getProceduralTrackUrl(vibe),
          };
        });
        offlineStorage.saveTracks(activeTracks).catch(() => {});
      }

      // Automatically sync cloud audio tracks uploaded from laptop/desktop so they show up on phone!
      try {
        const cloudTracks = await cloudSyncService.fetchCloudTracks();
        if (cloudTracks.length > 0) {
          setCloudTracksCount(cloudTracks.length);
          const existingIds = new Set(activeTracks.map((t) => t.id));
          const newCloudTracks = cloudTracks.filter((ct) => !existingIds.has(ct.id));
          if (newCloudTracks.length > 0) {
            activeTracks = [...newCloudTracks, ...activeTracks];
            offlineStorage.saveTracks(activeTracks).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Could not load cloud tracks on init:', err);
      }

      setTracks(activeTracks);
      setQueue(activeTracks);

      // Restore last session's playback state & last track played
      const lastSession = await offlineStorage.getKV<{
        trackId: string;
        queueIds?: string[];
        currentTime?: number;
        history?: string[];
      }>('last_playback_session');

      let restoredTrack: Track | null = null;
      if (lastSession?.trackId) {
        restoredTrack = activeTracks.find((t) => t.id === lastSession.trackId) || null;
      }

      if (lastSession?.queueIds && lastSession.queueIds.length > 0) {
        const restoredQueue = lastSession.queueIds
          .map((id) => activeTracks.find((t) => t.id === id))
          .filter((t): t is Track => t !== undefined);
        if (restoredQueue.length > 0) {
          setQueue(restoredQueue);
        }
      }

      if (lastSession?.history && Array.isArray(lastSession.history)) {
        setPlayHistory(lastSession.history);
      }

      const initialTrack = restoredTrack || (activeTracks.length > 0 ? activeTracks[0] : null);
      if (initialTrack) {
        setCurrentTrack(initialTrack);
        audioEngine.updateMediaMetadata(initialTrack);
        if (lastSession?.currentTime && lastSession.currentTime > 0) {
          setCurrentTime(lastSession.currentTime);
          const dur = initialTrack.duration || 75;
          setProgress((lastSession.currentTime / dur) * 100);
        }
      } else {
        setCurrentTrack(null);
      }

      // Background process: find official album & song covers for tracks
      (async () => {
        let tracksUpdated = false;
        const tracksNeedingIdentification = activeTracks.filter(
          (t) => !t.coverUrl || !t.album || t.album === 'Device Music' || /masstamilan|starmusiq/i.test(t.album)
        );
        for (const t of tracksNeedingIdentification) {
          try {
            const identified = await identifyTrackOnline(t.title, t.artist, t.album);
            if (identified) {
              if (identified.coverUrl) t.coverUrl = identified.coverUrl;
              if (identified.album) t.album = identified.album;
              if (identified.artist && (!t.artist || t.artist === 'Local Artist' || t.artist === 'Unknown Artist')) {
                t.artist = identified.artist;
              }
              tracksUpdated = true;
            } else if (!t.coverUrl) {
              const cover = await fetchCoverArtForTrack(t.title, t.artist, t.album, t.genre);
              if (cover) {
                t.coverUrl = cover;
                tracksUpdated = true;
              }
            }
          } catch {
            // Continue
          }
        }
        if (tracksUpdated) {
          setTracks([...activeTracks]);
          offlineStorage.saveTracks(activeTracks).catch(() => {});
          if (initialTrack) {
            const updatedInit = activeTracks.find((t) => t.id === initialTrack.id);
            if (updatedInit) {
              setCurrentTrack({ ...updatedInit });
              audioEngine.updateMediaMetadata(updatedInit);
            }
          }
        }
      })();
    };

    initApp();
  }, []);

  // Dedicated function to poll or manually check for new audio uploaded from laptop/desktop
  const handleSyncCloudTracks = async (silent: boolean = false) => {
    setIsSyncingWithCloud(true);
    try {
      const res = await cloudSyncService.syncWithCloud(tracksRef.current);
      setCloudTracksCount(res.count);
      if (res.newTracks.length > 0) {
        const combined = [...res.newTracks, ...tracksRef.current];
        setTracks(combined);
        setQueue((prev) => [...res.newTracks, ...prev]);
        await offlineStorage.saveTracks(combined).catch(() => {});
        setCleanFeedback(
          `☁️ Synced "${res.newTracks[0].title}" from laptop!`
        );
        setTimeout(() => setCleanFeedback(null), 4500);
      } else if (!silent) {
        setCleanFeedback(
          res.count > 0
            ? `☁️ All ${res.count} cloud tracks from laptop are synchronized!`
            : '☁️ Cloud is synchronized with your library.'
        );
        setTimeout(() => setCleanFeedback(null), 3500);
      }
    } catch (err) {
      console.warn('Cloud sync error:', err);
      if (!silent) {
        setCleanFeedback('Failed to reach cloud storage. Check your connection.');
        setTimeout(() => setCleanFeedback(null), 3500);
      }
    } finally {
      setIsSyncingWithCloud(false);
    }
  };

  // Automatic Background Cloud Sync for Mobile Phone & Cross-Device Access
  useEffect(() => {
    let isMounted = true;

    // Fast check 1.5 seconds after mounting
    const initialTimer = setTimeout(() => {
      if (isMounted) handleSyncCloudTracks(true);
    }, 1500);

    // Periodic check every 12 seconds when the page is active
    const intervalTimer = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        handleSyncCloudTracks(true);
      }
    }, 12000);

    const onFocus = () => {
      handleSyncCloudTracks(true);
    };

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleSyncCloudTracks(true);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Subscribe to cloud sync service events (e.g. when laptop completes an upload)
    const unsubscribeSync = cloudSyncService.subscribe((event) => {
      if (event.type === 'upload-complete' && event.tracks && event.tracks.length > 0) {
        const uploaded = event.tracks[0];
        const currentList = tracksRef.current;
        if (!currentList.some((t) => t.id === uploaded.id)) {
          const updated = [uploaded, ...currentList];
          setTracks(updated);
          setQueue((prev) => [uploaded, ...prev]);
          offlineStorage.saveTracks(updated).catch(() => {});
        }
        setCloudTracksCount((prev) => prev + 1);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubscribeSync();
    };
  }, []);

  const handleClearLibrary = async () => {
    await offlineStorage.clearTracks().catch(() => {});
    setTracks([]);
    setQueue([]);
    setPlaylists([]);
    setFolders([]);
    setCurrentTrack(null);
    audioEngine.pause();
  };

  // Subscribe to audio engine events
  useEffect(() => {
    let lastSaveTime = 0;
    const unsubscribe = audioEngine.subscribe((state) => {
      setIsPlaying(state.isPlaying);
      setCurrentTime(state.currentTime);
      setDuration(state.duration || (currentTrack?.duration ?? 75));
      setProgress(state.progress);

      // Periodically persist playback session state every 3 seconds while playing
      const now = Date.now();
      if (currentTrack && state.isPlaying && now - lastSaveTime > 3000) {
        lastSaveTime = now;
        offlineStorage.setKV('last_playback_session', {
          trackId: currentTrack.id,
          queueIds: queue.map((t) => t.id),
          currentTime: Math.round(state.currentTime),
          history: playHistory,
        }).catch(() => {});
      }
    });

    handleNextTrackRef.current = handleNextTrack;
    handlePrevTrackRef.current = handlePrevTrack;

    audioEngine.onEndedCallback = () => {
      handleNextTrackRef.current();
    };

    audioEngine.onNextCallback = () => {
      handleNextTrackRef.current();
    };
    audioEngine.onPrevCallback = () => {
      handlePrevTrackRef.current();
    };
    audioEngine.onSeekCallback = (s) => {
      audioEngine.seek(s);
    };

    if (currentTrack) {
      audioEngine.updateMediaMetadata(currentTrack);
    }

    return () => {
      unsubscribe();
    };
  }, [currentTrack, repeatMode, queue, tracks, isSmartShuffleActive]);

  // Keep screen awake via Screen Wake Lock API if user enabled study/awake mode
  useEffect(() => {
    let wakeLockSentinel: any = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isPlaying && preferences.keepScreenAwake) {
        try {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        } catch {
          // Ignore wake lock rejection
        }
      }
    };

    if (isPlaying && preferences.keepScreenAwake) {
      requestWakeLock();
    }

    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [isPlaying, preferences.keepScreenAwake]);

  // Handle Play/Pause: MUST be synchronous to preserve Android touch gesture token!
  const handlePlayPause = () => {
    if (!currentTrack) {
      if (tracks.length > 0) {
        handleSelectTrack(tracks[0]);
      }
      return;
    }

    if (isPlaying) {
      audioEngine.pause();
    } else {
      let url = currentTrack.audioUrl;
      if (!url) {
        const vibe = currentTrack.genre.toLowerCase().includes('synth') ? 'synthwave' : 'lofi';
        url = audioEngine.getProceduralTrackUrl(vibe);
        currentTrack.audioUrl = url;
      }
      audioEngine.playTrack(url, currentTime);
    }
  };

  // Play a specific track: MUST be synchronous to preserve Android touch gesture token!
  const handleSelectTrack = (track: Track, newQueue?: Track[]) => {
    // Record into history stack if this is a new track and not a history back navigation
    if (currentTrack && currentTrack.id !== track.id && !isNavigatingHistoryRef.current) {
      setPlayHistory((prev) => [...prev, currentTrack.id]);
    }
    isNavigatingHistoryRef.current = false;

    setCurrentTrack(track);
    if (newQueue) setQueue(newQueue);

    // Persist current session state to IndexedDB so it's remembered when exiting and re-opening
    offlineStorage.setKV('last_playback_session', {
      trackId: track.id,
      queueIds: (newQueue || queue).map((t) => t.id),
      currentTime: 0,
      history: playHistory,
    }).catch(() => {});

    // Update metadata and persist stats in background (non-blocking)
    track.playCount = (track.playCount || 0) + 1;
    track.lastPlayed = Date.now();
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      setTracks([...tracks]);
    }
    offlineStorage.saveTracks(tracks).catch(() => {});

    // Update system lockscreen media metadata immediately
    audioEngine.updateMediaMetadata(track);

    let url = track.audioUrl;
    if (!url) {
      const vibe = track.genre.toLowerCase().includes('synth')
        ? 'synthwave'
        : track.genre.toLowerCase().includes('ambient')
        ? 'ambient'
        : 'lofi';
      url = audioEngine.getProceduralTrackUrl(vibe);
      track.audioUrl = url;
    }

    // Call playTrack synchronously inside user touch event!
    audioEngine.playTrack(url, 0);

    // Preload next upcoming track in the queue so continuous playback has 0ms latency
    const activeQ = newQueue || (queueRef.current.length > 0 ? queueRef.current : tracksRef.current);
    const currIdx = activeQ.findIndex((t) => t.id === track.id);
    const nxtIdx = currIdx === -1 || currIdx >= activeQ.length - 1 ? 0 : currIdx + 1;
    const upcomingTrack = activeQ[nxtIdx];
    if (upcomingTrack) {
      if (!upcomingTrack.audioUrl) {
        const vibe = upcomingTrack.genre.toLowerCase().includes('synth')
          ? 'synthwave'
          : upcomingTrack.genre.toLowerCase().includes('ambient')
          ? 'ambient'
          : 'lofi';
        upcomingTrack.audioUrl = audioEngine.getProceduralTrackUrl(vibe);
        audioEngine.preloadNextTrack(upcomingTrack.audioUrl);
      } else if (upcomingTrack.blobId && !upcomingTrack.audioUrl.startsWith('blob:')) {
        offlineStorage.getAudioBlob(upcomingTrack.blobId).then((b) => {
          if (b) {
            upcomingTrack.audioUrl = URL.createObjectURL(b);
            audioEngine.preloadNextTrack(upcomingTrack.audioUrl);
          }
        }).catch(() => {});
      } else {
        audioEngine.preloadNextTrack(upcomingTrack.audioUrl);
      }
    }

    // If track has local blob, refresh in background if needed
    if (track.blobId && !url.startsWith('blob:')) {
      offlineStorage.getAudioBlob(track.blobId).then((blob) => {
        if (blob) {
          track.audioUrl = URL.createObjectURL(blob);
        }
      }).catch(() => {});
    }

    // Ensure official high-resolution cover art and official album are identified for active track if missing
    // Only query online services when app is in foreground to prevent battery drain while phone screen is off
    const isForeground = typeof document === 'undefined' || document.visibilityState === 'visible';
    if (isForeground && (!track.coverUrl || !track.album || track.album === 'Device Music' || /masstamilan|starmusiq/i.test(track.album))) {
      identifyTrackOnline(track.title, track.artist, track.album).then((identified) => {
        if (identified) {
          if (identified.coverUrl) track.coverUrl = identified.coverUrl;
          if (identified.album) track.album = identified.album;
          if (identified.artist && (!track.artist || track.artist === 'Local Artist' || track.artist === 'Unknown Artist')) {
            track.artist = identified.artist;
          }
          setCurrentTrack({ ...track });
          audioEngine.updateMediaMetadata(track);
          setTracks((prev) => [...prev]);
          offlineStorage.saveTracks(tracks).catch(() => {});
        } else if (!track.coverUrl) {
          fetchCoverArtForTrack(track.title, track.artist, track.album, track.genre).then((cov) => {
            if (cov) {
              track.coverUrl = cov;
              setCurrentTrack({ ...track });
              audioEngine.updateMediaMetadata(track);
              setTracks((prev) => [...prev]);
              offlineStorage.saveTracks(tracks).catch(() => {});
            }
          });
        }
      });
    }
  };

  // Next Track: Synchronous and reliable skip with wrap-around
  const handleNextTrack = () => {
    const activeQueue = queueRef.current.length > 0 ? queueRef.current : tracksRef.current;
    if (activeQueue.length === 0) return;

    if (repeatModeRef.current === 'one' && currentTrackRef.current) {
      audioEngine.seek(0);
      audioEngine.resume();
      return;
    }

    if (isSmartShuffleActiveRef.current && activeQueue.length > 1) {
      const candidates = activeQueue.filter((t) => t.id !== currentTrackRef.current?.id);
      const randomTrack = candidates[Math.floor(Math.random() * candidates.length)];
      if (randomTrack) {
        handleSelectTrack(randomTrack, activeQueue);
        return;
      }
    }

    const currentIdx = activeQueue.findIndex((t) => t.id === currentTrackRef.current?.id);
    const nextIdx = currentIdx === -1 || currentIdx >= activeQueue.length - 1 ? 0 : currentIdx + 1;
    handleSelectTrack(activeQueue[nextIdx], activeQueue);
  };

  // Previous Track: If track has played > 3s restart it; otherwise go to the genuine LAST SONG PLAYED in history
  const handlePrevTrack = () => {
    if (currentTime > 3) {
      audioEngine.seek(0);
      return;
    }

    const activeQueue = queueRef.current.length > 0 ? queueRef.current : tracksRef.current;
    if (activeQueue.length === 0) return;

    // Check history stack first for last played song
    if (playHistory.length > 0) {
      const newHistory = [...playHistory];
      const lastPlayedId = newHistory.pop();
      setPlayHistory(newHistory);
      if (lastPlayedId) {
        const lastTrack = tracksRef.current.find((t) => t.id === lastPlayedId) || activeQueue.find((t) => t.id === lastPlayedId);
        if (lastTrack) {
          isNavigatingHistoryRef.current = true;
          handleSelectTrack(lastTrack, activeQueue);
          return;
        }
      }
    }

    // Fallback: previous track in current queue
    const currentIdx = activeQueue.findIndex((t) => t.id === currentTrackRef.current?.id);
    const prevIdx = currentIdx <= 0 ? activeQueue.length - 1 : currentIdx - 1;
    handleSelectTrack(activeQueue[prevIdx], activeQueue);
  };

  // Toggle Like Track
  const handleToggleLike = (trackId: string) => {
    const updated = tracks.map((t) => (t.id === trackId ? { ...t, liked: !t.liked } : t));
    setTracks(updated);
    offlineStorage.saveTracks(updated);
  };

  // Toggle Offline Cache
  const handleToggleOfflineCache = async (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    track.isOfflineAvailable = !track.isOfflineAvailable;
    setTracks([...tracks]);
    await offlineStorage.saveTracks(tracks);
  };

  // Update lyric sync offset for track & keep state synchronized
  const handleUpdateTrackSyncOffset = (trackId: string, offset: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, syncOffset: offset } : t))
    );
    if (currentTrackRef.current?.id === trackId) {
      setCurrentTrack((prev) => (prev ? { ...prev, syncOffset: offset } : null));
    }
  };

  // Smart Shuffle toggle
  const handleToggleSmartShuffle = async () => {
    const nextState = !isSmartShuffleActive;
    setIsSmartShuffleActive(nextState);
    if (nextState) {
      const res = await aiService.smartShuffle(tracks, currentTrack?.id, currentMood, stats);
      setSmartShuffleRationale(res.rationale);
    }
  };

  // Add Tracks from device files
  const handleTracksAdded = (newTracks: Track[]) => {
    const sanitized = newTracks.map(sanitizeTrack);
    const combined = [...sanitized, ...tracks];
    setTracks(combined);
    setQueue(combined);
    if (sanitized.length > 0) {
      handleSelectTrack(sanitized[0], combined);
    }
  };

  // Dedicated scanner to separate artists from titles across all stored tracks
  const [isCleaningMetadata, setIsCleaningMetadata] = useState(false);
  const [cleanFeedback, setCleanFeedback] = useState<string | null>(null);

  const handleCleanMetadata = async () => {
    setIsCleaningMetadata(true);
    let updatedCount = 0;
    const updatedTracks: Track[] = [];

    for (const track of tracks) {
      let t = sanitizeTrack(track);
      if (t.isLocal || t.blobId) {
        const blob = await offlineStorage.getAudioBlob(t.blobId || t.id);
        if (blob) {
          const tags = await readAudioTags(blob).catch(() => null);
          if (tags) {
            if (tags.title) t.title = tags.title;
            if (tags.artist) t.artist = tags.artist;
            if (tags.album && (!t.album || t.album === 'Device Music')) t.album = tags.album;
            if (tags.genre && (!t.genre || t.genre === 'Electronic')) t.genre = tags.genre;
            if (tags.coverUrl && !t.coverUrl) t.coverUrl = tags.coverUrl;
            t = sanitizeTrack(t);
          }
        }
      }

      // Online identification of song and official album
      try {
        const identified = await identifyTrackOnline(t.title, t.artist, t.album);
        if (identified) {
          if (identified.coverUrl) t.coverUrl = identified.coverUrl;
          if (identified.album) t.album = identified.album;
          if (identified.artist && (!t.artist || t.artist === 'Local Artist' || t.artist === 'Unknown Artist')) {
            t.artist = identified.artist;
          }
          if (identified.title && (t.title === 'Audio Track' || !t.title)) {
            t.title = identified.title;
          }
        }
      } catch {
        // Continue
      }

      if (!t.coverUrl) {
        const art = await fetchCoverArtForTrack(t.title, t.artist, t.album, t.genre);
        if (art) {
          t.coverUrl = art;
          updatedCount++;
        }
      }

      if (t.title !== track.title || t.artist !== track.artist || t.album !== track.album || t.coverUrl !== track.coverUrl) {
        updatedCount++;
      }
      updatedTracks.push(t);
    }

    setTracks(updatedTracks);
    setQueue(updatedTracks);
    if (currentTrack) {
      const updatedCurrent = updatedTracks.find((tr) => tr.id === currentTrack.id);
      if (updatedCurrent) {
        setCurrentTrack(updatedCurrent);
        audioEngine.updateMediaMetadata(updatedCurrent);
      }
    }
    await offlineStorage.saveTracks(updatedTracks).catch(() => {});
    setIsCleaningMetadata(false);
    setCleanFeedback(
      `Cleaned & separated artist names for ${updatedCount} track${updatedCount === 1 ? '' : 's'}!`
    );
    setTimeout(() => setCleanFeedback(null), 4500);
  };

  // Open share for a playlist
  const handleOpenSharePlaylist = (playlist: Playlist) => {
    setSelectedPlaylistForShare(playlist);
    setIsShareOpen(true);
  };

  // Play an entire playlist immediately
  const handlePlayPlaylist = (trackIds: string[], playlistTitle?: string) => {
    const matchingTracks = trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => t !== undefined);

    if (matchingTracks.length > 0) {
      setQueue(matchingTracks);
      handleSelectTrack(matchingTracks[0], matchingTracks);
      setCleanFeedback(`Now playing "${playlistTitle || 'Smart Playlist'}" (${matchingTracks.length} tracks)`);
      setTimeout(() => setCleanFeedback(null), 4000);
    }
  };

  // Filtered tracks for Library view
  const filteredTracks = tracks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.genre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre =
      selectedGenreFilter === 'All' || t.genre.toLowerCase().includes(selectedGenreFilter.toLowerCase());
    const matchesOffline = !preferences.offlineOnlyMode || t.isOfflineAvailable;
    return matchesSearch && matchesGenre && matchesOffline;
  });

  const availableGenres = ['All', ...Array.from(new Set(tracks.map((t) => t.genre)))];

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between selection:bg-orange-500 selection:text-white transition-colors duration-200 ${
      isLightMode ? 'bg-slate-100 text-slate-900' : 'bg-[#0c0c0e] text-zinc-100'
    }`}>
      {/* 
        ZONE 1-3 TOP BAR CONTRACT:
        [Wordmark: Vettify] -- [Nav links: Library · Deck · Equalizer · Collections] -- [Primary CTA: Import Audio]
      */}
      <header className={`sticky top-0 z-30 border-b px-4 sm:px-8 py-3 transition-colors duration-200 ${
        isLightMode
          ? 'bg-white/90 backdrop-blur-md border-slate-200 text-slate-800 shadow-xs'
          : 'bg-[#121216] border-zinc-800 text-zinc-100'
      }`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-sm font-bold tracking-tight whitespace-nowrap ${
              isLightMode ? 'text-slate-900' : 'text-white'
            }`}>
              Vettify
            </span>
            <span className={`text-[11px] font-mono uppercase tracking-wider hidden sm:inline ${
              isLightMode ? 'text-slate-500' : 'text-zinc-500'
            }`}>
              Studio Player
            </span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className={`hidden md:flex items-center gap-6 text-xs font-medium ${
            isLightMode ? 'text-slate-600' : 'text-zinc-400'
          }`}>
            <button
              onClick={() => setActiveNav('library')}
              className={`hover:opacity-100 transition whitespace-nowrap ${
                activeNav === 'library'
                  ? (isLightMode ? 'text-slate-950 font-bold' : 'text-white font-semibold')
                  : ''
              }`}
            >
              Track Library
            </button>
            <button
              onClick={() => setActiveNav('deck')}
              className={`hover:opacity-100 transition whitespace-nowrap ${
                activeNav === 'deck'
                  ? (isLightMode ? 'text-slate-950 font-bold' : 'text-white font-semibold')
                  : ''
              }`}
            >
              Master Deck
            </button>
            <button
              onClick={() => setIsEqOpen(true)}
              className="hover:opacity-100 transition whitespace-nowrap"
            >
              Parametric EQ
            </button>
            <button
              onClick={() => setActiveNav('collections')}
              className={`hover:opacity-100 transition whitespace-nowrap ${
                activeNav === 'collections'
                  ? (isLightMode ? 'text-slate-950 font-bold' : 'text-white font-semibold')
                  : ''
              }`}
            >
              Collections
            </button>
          </nav>

          {/* Zone 3: Primary Action Button & Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Theme Toggle Button */}
            <button
              onClick={handleToggleTheme}
              className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 text-xs font-semibold shadow-xs ${
                isLightMode
                  ? 'bg-amber-100/90 border-amber-300 text-amber-950 hover:bg-amber-200'
                  : 'bg-zinc-800/80 border-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-700'
              }`}
              title={isLightMode ? 'Switch to Dark Studio' : 'Switch to High-Contrast Light Studio'}
              aria-label="Toggle Studio Theme"
            >
              {isLightMode ? (
                <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className="hidden sm:inline text-[11px]">
                {isLightMode ? 'Light' : 'Dark'}
              </span>
            </button>

            {/* Cloud Sync Button */}
            <button
              onClick={() => setIsCloudSyncOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 text-xs font-semibold transition active:scale-95 shadow-sm"
              title="Laptop ⇄ Phone Cloud Audio Sync"
            >
              <Cloud className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Cloud Sync</span>
              {cloudTracksCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                  {cloudTracksCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsSmartPlaylistMakerOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/15 border border-orange-500/30 text-orange-400 hover:bg-orange-600/25 text-xs font-semibold transition active:scale-95 shadow-sm whitespace-nowrap"
              title="Launch Smart Playlist Maker"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Playlists</span>
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`hidden sm:flex p-2 rounded-lg transition ${
                isLightMode ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/80' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition active:scale-95 shadow-sm whitespace-nowrap"
            >
              Import Audio
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={`flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 flex flex-col min-h-0 ${
          activeNav === 'deck'
            ? 'py-1 sm:py-2 pb-3 min-h-[calc(100vh-4.25rem)] md:h-[calc(100vh-4.25rem)] justify-center overflow-y-auto md:overflow-hidden'
            : 'py-5 pb-24'
        }`}
      >
        {activeNav === 'deck' ? (
          /* DEDICATED MASTER DECK VIEW - Engineered to fit prominent studio platter & peak analyzer */
          <div className="w-full flex-1 flex flex-col justify-center animate-in fade-in py-0 max-h-full">
            <div className="bg-[#141418] border border-zinc-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xl relative overflow-y-auto md:overflow-hidden flex flex-col justify-between max-h-none md:max-h-[calc(100vh-5rem)]">
              {/* Header Status Bar */}
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800 mb-3 px-0.5 shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-orange-500 animate-pulse' : 'bg-zinc-600'}`} />
                  <span className="text-[11px] sm:text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
                    Master Analog Deck · 33⅓ RPM Hi-Fi Studio Platter
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] sm:text-xs font-mono text-orange-400">
                    {isPlaying ? 'ROTATING · 33 RPM' : 'STANDBY'}
                  </span>
                  <button
                    onClick={() => setActiveNav('library')}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition px-2 py-0.5 rounded-md hover:bg-zinc-800"
                    title="Return to Track Library"
                  >
                    <ListMusic className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Track Library</span>
                  </button>
                </div>
              </div>

              {/* Master Studio Console Grid: 3-Column Studio Layout on Desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch flex-1 min-h-0 py-1">
                {/* Desktop Left Column (col-span-4): Live Karaoke & Lyrics */}
                <div className="hidden lg:flex lg:col-span-4 flex-col bg-[#0e0e11] border border-zinc-800/80 rounded-2xl p-3 shadow-xl overflow-hidden min-h-[460px]">
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <KaraokeLyricsBar
                      currentTrack={currentTrack}
                      currentTime={currentTime}
                      duration={duration}
                      isPlaying={isPlaying}
                      onSeek={(s) => audioEngine.seek(s)}
                      onUpdateSyncOffset={handleUpdateTrackSyncOffset}
                      mode="stage"
                      isLightMode={isLightMode}
                    />
                  </div>
                </div>

                {/* Center Column (lg:col-span-5): Turntable Platter, Controls & Peak Analyzer */}
                <div className="col-span-1 lg:col-span-5 flex flex-col justify-between space-y-3">
                  {/* Rotating Platter */}
                  <div className="flex flex-col items-center justify-center py-1">
                    <PixelTurntableWidget
                      currentTrack={currentTrack}
                      isPlaying={isPlaying}
                      onPlayPause={handlePlayPause}
                      onNext={handleNextTrack}
                      onPrev={handlePrevTrack}
                      onToggleLike={handleToggleLike}
                      onOpenPlayer={() => setIsFullScreenOpen(true)}
                      size="master"
                      showControls={false}
                      showTrackInfo={false}
                    />
                  </div>

                  {/* Single High-Fidelity Track & Official Album Identification */}
                  <div className="bg-[#0e0e11] border border-zinc-800/80 rounded-xl p-3 sm:p-3.5 relative overflow-hidden">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9px] font-mono font-semibold text-orange-400 uppercase tracking-widest px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20">
                            NOW PLAYING
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 uppercase">
                            {currentTrack?.format || 'PCM'} · {currentTrack?.bitrate || '320k'}
                          </span>
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-white truncate tracking-tight">
                          {currentTrack?.title || 'No Track Selected'}
                        </h2>
                        <div className="flex items-center gap-2 text-xs truncate mt-0.5 text-zinc-300">
                          <span className="font-semibold text-orange-400 truncate">
                            {currentTrack?.artist || 'Select a track to play'}
                          </span>
                          {currentTrack?.album && (
                            <>
                              <span className="text-zinc-600">·</span>
                              <span className="text-zinc-400 truncate flex items-center gap-1 text-[11px]">
                                <Disc3 className="w-3 h-3 text-orange-400 shrink-0" />
                                {currentTrack.album}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => currentTrack && handleToggleLike(currentTrack.id)}
                          className={`p-1.5 rounded-lg transition ${
                            currentTrack?.liked ? 'text-orange-500 bg-orange-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                          }`}
                          title="Like Track"
                        >
                          <Heart className="w-4 h-4 fill-current" />
                        </button>
                        <button
                          onClick={() => setIsFullScreenOpen(true)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-[11px] font-mono"
                          title="Expand Master Player"
                        >
                          Expand ↗
                        </button>
                      </div>
                    </div>

                    {/* Integrated Scrubber Bar directly in Master Deck */}
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/80">
                      <div
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pos = (e.clientX - rect.left) / rect.width;
                          audioEngine.seek(pos * duration);
                        }}
                        className="relative h-1.5 bg-zinc-800 hover:bg-zinc-700/80 rounded-full cursor-pointer transition-colors overflow-hidden"
                      >
                        <div
                          className="h-full bg-orange-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 tabular-nums mt-1">
                        <span>{formatTime(currentTime)}</span>
                        {/* Playback Transport Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handlePrevTrack}
                            className="p-1 text-zinc-400 hover:text-white transition"
                            title="Previous Track"
                          >
                            <SkipBack className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handlePlayPause}
                            className="w-6 h-6 rounded-full bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center transition active:scale-95 shadow-sm"
                            title={isPlaying ? 'Pause' : 'Play'}
                          >
                            {isPlaying ? (
                              <Pause className="w-3 h-3 fill-current" />
                            ) : (
                              <Play className="w-3 h-3 fill-current ml-0.5" />
                            )}
                          </button>
                          <button
                            onClick={handleNextTrack}
                            className="p-1 text-zinc-400 hover:text-white transition"
                            title="Next Track"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Peak Level Analyzer (60 FPS, No Oscilloscope) */}
                  <div className="bg-[#0e0e11] border border-zinc-800/80 rounded-xl p-2.5 sm:p-3">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-orange-500 animate-pulse' : 'bg-zinc-600'}`} />
                        PEAK LEVEL ANALYZER · VU
                      </span>
                      <span className="text-orange-400 font-mono text-[10px] font-bold">{isPlaying ? meterDb : '-∞ dB'}</span>
                    </div>
                    <AudioVisualizer mode="bars" height={32} isPlaying={isPlaying} />
                    <div className="flex justify-between text-[9px] font-mono text-zinc-500 mt-0.5 px-0.5">
                      <span>32Hz</span>
                      <span>250Hz</span>
                      <span>1kHz</span>
                      <span>4kHz</span>
                      <span>16kHz</span>
                    </div>
                  </div>

                  {/* Mobile-Only Docked Lyrics Bar */}
                  <div className="pt-1 lg:hidden">
                    <KaraokeLyricsBar
                      currentTrack={currentTrack}
                      currentTime={currentTime}
                      duration={duration}
                      isPlaying={isPlaying}
                      onSeek={(s) => audioEngine.seek(s)}
                      onUpdateSyncOffset={handleUpdateTrackSyncOffset}
                      mode="docked"
                      onToggleStage={() => setIsFullScreenOpen(true)}
                      isLightMode={isLightMode}
                    />
                  </div>
                </div>

                {/* Desktop Right Column (col-span-3): Playback Queue (Up Next) */}
                <div className="hidden lg:flex lg:col-span-3 flex-col bg-[#0e0e11] border border-zinc-800/80 rounded-2xl p-3.5 shadow-xl overflow-hidden min-h-[460px]">
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800 shrink-0 mb-2">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <ListMusic className="w-3.5 h-3.5 text-orange-400" />
                      Playback Queue
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">{queue.length} tracks</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {queue.map((track) => (
                      <div
                        key={track.id}
                        onClick={() => handleSelectTrack(track)}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                          currentTrack?.id === track.id
                            ? 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
                            : 'hover:bg-zinc-800/80 text-zinc-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-400">
                            {currentTrack?.id === track.id ? (
                              <span className="text-orange-400 text-xs font-bold">▶</span>
                            ) : (
                              <Music className="w-3 h-3 text-zinc-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-semibold truncate ${currentTrack?.id === track.id ? 'text-orange-400' : 'text-zinc-100'}`}>
                              {track.title}
                            </p>
                            <p className="text-[10px] font-medium text-zinc-400 truncate">
                              {track.artist}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0 ml-2">
                          {formatTime(track.duration)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeNav === 'collections' ? (
          /* DEDICATED COLLECTIONS & SMART PLAYLISTS VIEW */
          <div className="w-full space-y-6 animate-in fade-in pb-12">
            {/* Collections Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl sm:rounded-3xl bg-[#141418] border border-zinc-800 shadow-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Smart Playlists & Collections
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-semibold border border-orange-500/30 uppercase">
                    AI Curated
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                  Intelligent playlists generated from your {tracks.length} library tracks, organized by musical genre and international/multilingual lineage.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setIsSmartPlaylistMakerOpen(true)}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create Smart Playlist</span>
                </button>
                <button
                  onClick={() => setIsAiCuratorOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition"
                >
                  Mix Organizer
                </button>
              </div>
            </div>

            {/* Playlists Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span className="font-semibold text-zinc-200">
                  Curated Playlists ({playlists.length})
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  Select any playlist to queue and start playback
                </span>
              </div>

              {playlists.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#141418] border border-zinc-800 text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-orange-400 mx-auto" />
                  <h3 className="text-sm font-bold text-white">No Playlists Created Yet</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Use the Smart Playlist Maker to auto-generate playlists based on your library songs' genres and international languages.
                  </p>
                  <button
                    onClick={() => setIsSmartPlaylistMakerOpen(true)}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-sm"
                  >
                    Launch Smart Playlist Maker
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {playlists.map((playlist) => {
                    const trackCount = playlist.trackIds.length;
                    return (
                      <div
                        key={playlist.id}
                        className="group bg-[#141418] border border-zinc-800/90 hover:border-zinc-700 rounded-2xl p-4 transition shadow-md flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/60 flex items-center justify-center text-lg shadow-inner">
                              {playlist.coverEmoji || (playlist.isSmartPlaylist ? '✨' : '🎵')}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handlePlayPlaylist(playlist.trackIds, playlist.title)}
                                className="p-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white transition shadow-sm active:scale-95"
                                title="Play Entire Playlist"
                              >
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              </button>
                              <button
                                onClick={() => handleOpenSharePlaylist(playlist)}
                                className="p-2 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
                                title="Share Playlist"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h3 className="text-sm font-bold text-white group-hover:text-orange-400 transition tracking-tight">
                            {playlist.title}
                          </h3>
                          <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                            {playlist.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-1.5 mt-3">
                            {playlist.genreCategory && (
                              <span className="px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700 text-[10px] font-mono text-zinc-300">
                                {playlist.genreCategory}
                              </span>
                            )}
                            {playlist.languageCategory && (
                              <span className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-[10px] font-mono text-orange-300 flex items-center gap-1">
                                <Globe className="w-2.5 h-2.5" />
                                <span>{playlist.languageCategory}</span>
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-zinc-500">
                              {trackCount} track{trackCount === 1 ? '' : 's'}
                            </span>
                          </div>

                          {playlist.culturalContext && (
                            <div className="mt-2 text-[11px] text-zinc-500 italic line-clamp-1">
                              "{playlist.culturalContext}"
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                          <span className="text-[11px] font-mono text-zinc-500">
                            {playlist.curator || 'Vettify'}
                          </span>
                          <button
                            onClick={() => handlePlayPlaylist(playlist.trackIds, playlist.title)}
                            className="text-orange-400 hover:text-orange-300 font-semibold text-xs transition flex items-center gap-1"
                          >
                            <span>Queue Tracks</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* DESKTOP 2-COLUMN STUDIO WORKSTATION LAYOUT */
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
            {/* PRIMARY COLUMN: LIBRARY & TRACK LIST (7 Cols on desktop) */}
            <div className="lg:col-span-7 space-y-5">
            {/* Library Controls Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#141418] border border-zinc-800 p-3 sm:p-3.5 rounded-xl">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by title, artist, or genre..."
                  className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Action Buttons: Clean scrollable row on mobile without cutoff */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
                <button
                  onClick={() => handleSyncCloudTracks(false)}
                  disabled={isSyncingWithCloud}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 text-xs font-semibold text-cyan-300 transition shadow-sm active:scale-95 whitespace-nowrap disabled:opacity-50"
                  title="Check for audio uploaded from your laptop"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncingWithCloud ? 'animate-spin' : ''}`} />
                  <span>{isSyncingWithCloud ? 'Syncing...' : 'Sync Laptop'}</span>
                </button>
                <button
                  onClick={() => setIsSmartPlaylistMakerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/40 text-xs font-semibold text-orange-300 transition flex items-center gap-1.5 shadow-sm active:scale-95 whitespace-nowrap shrink-0"
                  title="Make smart playlists by genre & international language analysis"
                >
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  <span>Smart Playlists</span>
                </button>
                <button
                  onClick={() => setIsAiCuratorOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition whitespace-nowrap shrink-0"
                >
                  Mix Organizer
                </button>
                <button
                  onClick={handleToggleSmartShuffle}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0 ${
                    isSmartShuffleActive
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                  title="Shuffle Playback"
                >
                  Shuffle
                </button>
              </div>
            </div>

            {/* Sub-tabs & Segmented Genre Filter: Clean, tight layout without gaps */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-800/80 pb-2 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-semibold text-zinc-100 text-xs">
                  Tracks ({filteredTracks.length})
                </span>
                <button
                  onClick={handleCleanMetadata}
                  disabled={isCleaningMetadata}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-700/60 text-[11px] font-medium text-orange-400 hover:text-orange-300 transition shadow-sm active:scale-95 disabled:opacity-50"
                  title="Scan songs, separate artists from titles, and strip junk"
                >
                  <Wand2 className={`w-3 h-3 ${isCleaningMetadata ? 'animate-spin' : ''}`} />
                  <span>{isCleaningMetadata ? 'Cleaning...' : 'Clean Titles'}</span>
                </button>
              </div>

              {/* Clean Filter Links */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {availableGenres.slice(0, 5).map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenreFilter(genre)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] transition shrink-0 ${
                      selectedGenreFilter === genre
                        ? 'bg-zinc-800 text-orange-400 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {/* Clean Feedback Toast */}
            {cleanFeedback && (
              <div className="p-3 rounded-xl bg-orange-950/50 border border-orange-500/50 text-orange-200 text-xs flex items-center justify-between gap-3 shadow-lg animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="font-medium truncate">{cleanFeedback}</span>
                </div>
                <button
                  onClick={() => setCleanFeedback(null)}
                  className="text-orange-400 hover:text-orange-200 text-xs font-mono shrink-0 ml-2"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Empty Library State */}
            {filteredTracks.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#141418] border border-zinc-800 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                  <HardDrive className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Audio Library Empty</h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
                    Import local audio files (.mp3, .flac, .wav, .m4a, .aac) from your phone or storage drive for offline playback.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition"
                  >
                    Scan Music Folder
                  </button>
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
                  >
                    Pick Audio Files
                  </button>
                </div>
              </div>
            ) : (
              /* Tabular Track List */
              <div className="space-y-1">
                {filteredTracks.map((track, idx) => (
                  <div
                    key={track.id}
                    onClick={() => handleSelectTrack(track, filteredTracks)}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                      currentTrack?.id === track.id
                        ? 'bg-[#1c1c22] border-orange-500/50'
                        : 'bg-[#141418] border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    {/* Visual Audio Indicator (No raw numbers at beginning) */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-400 transition-colors">
                        {currentTrack?.id === track.id && isPlaying ? (
                          <span className="flex items-end gap-0.5 h-3 px-1">
                            <span className="w-0.5 h-3 bg-orange-400 animate-pulse rounded-full" />
                            <span className="w-0.5 h-2 bg-orange-400 animate-pulse delay-75 rounded-full" />
                            <span className="w-0.5 h-3.5 bg-orange-400 animate-pulse delay-150 rounded-full" />
                          </span>
                        ) : currentTrack?.id === track.id ? (
                          <Play className="w-3.5 h-3.5 text-orange-400 fill-current ml-0.5" />
                        ) : (
                          <Music className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4
                          className={`text-sm font-semibold truncate tracking-tight ${
                            currentTrack?.id === track.id ? 'text-orange-400' : 'text-zinc-100'
                          }`}
                        >
                          {track.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs truncate mt-0.5">
                          <span className="font-medium text-orange-400/90 truncate">
                            {track.artist}
                          </span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-400 uppercase font-mono text-[10px] shrink-0">
                            {track.format || 'MP3'}
                          </span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-500 truncate text-[11px]">{track.genre}</span>
                          {track.isCloudSynced && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/70 text-cyan-300 text-[9px] font-mono font-semibold flex items-center gap-1 shrink-0 ml-1">
                              <Cloud className="w-2.5 h-2.5 text-cyan-400" />
                              <span>Laptop Synced</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Meta: Duration, Like, Options */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-zinc-400 tabular-nums">
                        {formatTime(track.duration)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLike(track.id);
                        }}
                        className={`p-1.5 rounded-lg transition ${
                          track.liked ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                        title="Like Track"
                        aria-label="Like Track"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSharePlaylist({
                            id: `share-${track.id}`,
                            title: track.title,
                            description: `${track.artist} · ${track.genre}`,
                            trackIds: [track.id],
                            coverGradient: 'from-zinc-800 to-zinc-950',
                            createdAt: new Date().toISOString(),
                          });
                        }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 transition hidden sm:inline"
                        title="Share Track"
                        aria-label="Share Track"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECONDARY COLUMN: MASTER CONSOLE & ANALOG DECK (5 Cols on desktop) */}
          <div className="hidden lg:block lg:col-span-5 space-y-5">
            {/* Master Turntable Platter Card */}
            <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl text-center">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800 mb-3">
                <span className="text-xs font-mono text-zinc-400 uppercase">
                  Master Platter · 33 RPM
                </span>
                <span className="text-xs font-mono text-orange-400">
                  {isPlaying ? 'ACTIVE ROTATION' : 'STANDBY'}
                </span>
              </div>

              <PixelTurntableWidget
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onNext={handleNextTrack}
                onPrev={handlePrevTrack}
                onToggleLike={handleToggleLike}
                onOpenPlayer={() => setIsFullScreenOpen(true)}
                size="md"
                showControls={false}
                showTrackInfo={false}
              />

              {/* Peak Level Analyzer & Oscilloscope Trace on same card as turntable */}
              <div className="mt-4 pt-3 border-t border-zinc-800 text-left">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-orange-500 animate-pulse' : 'bg-zinc-600'}`} />
                    PEAK LEVEL ANALYZER · VU
                  </span>
                  <span className="text-orange-400 font-mono text-[10px] font-bold">{isPlaying ? meterDb : '-∞ dB'}</span>
                </div>
                <AudioVisualizer mode="bars" height={36} isPlaying={isPlaying} />
                <div className="flex justify-between text-[9px] font-mono text-zinc-500 mt-1 px-0.5">
                  <span>32Hz</span>
                  <span>250Hz</span>
                  <span>1kHz</span>
                  <span>4kHz</span>
                  <span>16kHz</span>
                </div>
              </div>

              {/* Technical Acoustic Specs Strip */}
              {currentTrack && (
                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span>FORMAT: {currentTrack.format || 'PCM'}</span>
                  <span>BITRATE: {currentTrack.bitrate || '320k'}</span>
                  <span>TIME: {formatTime(currentTime)}</span>
                </div>
              )}
            </div>

            {/* Integrated Karaoke Style Lyrics Bar (Desktop Sidebar Deck) */}
            <KaraokeLyricsBar
              currentTrack={currentTrack}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onSeek={(s) => audioEngine.seek(s)}
              onUpdateSyncOffset={handleUpdateTrackSyncOffset}
              mode="docked"
              onToggleStage={() => setIsFullScreenOpen(true)}
              isLightMode={isLightMode}
            />

            {/* Quick Parametric Controls */}
            <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-200">
                  Quick Acoustic Calibration
                </span>
                <button
                  onClick={() => setIsEqOpen(true)}
                  className="text-xs text-orange-400 hover:underline"
                >
                  Full 10-Band EQ
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Sub-Bass Response</span>
                    <span className="font-mono text-orange-400">{equalizer.bassBoost}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={equalizer.bassBoost}
                    onChange={(e) => {
                      const updated = { ...equalizer, bassBoost: parseInt(e.target.value, 10) };
                      setEqualizer(updated);
                      audioEngine.applyEqualizer(updated);
                    }}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Spatial Reflection</span>
                    <span className="font-mono text-orange-400">{equalizer.spatialSurround}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={equalizer.spatialSurround}
                    onChange={(e) => {
                      const updated = {
                        ...equalizer,
                        spatialSurround: parseInt(e.target.value, 10),
                      };
                      setEqualizer(updated);
                      audioEngine.applyEqualizer(updated);
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>

      {/* Docked Mini Player - Only shown when FullScreenPlayer is closed and not on dedicated Master Deck */}
      {!isFullScreenOpen && currentTrack && activeNav !== 'deck' && (
        <MiniPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          progress={progress}
          currentTime={currentTime}
          duration={duration}
          onSeek={(s) => audioEngine.seek(s)}
          onPlayPause={handlePlayPause}
          onNext={handleNextTrack}
          onToggleLike={handleToggleLike}
          onOpenFullScreen={() => setIsFullScreenOpen(true)}
          onOpenEq={() => setIsEqOpen(true)}
          isSmartShuffleActive={isSmartShuffleActive}
          smartShuffleRationale={smartShuffleRationale}
          isOfflineMode={preferences.offlineOnlyMode}
          hasBottomNav={true}
          isLightMode={isLightMode}
        />
      )}

      {/* Mobile Bottom Navigation Bar - Glass-morphic, sleek, 3-tab layout */}
      {!isFullScreenOpen && (
        <nav className={`sm:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t px-8 py-2.5 flex items-center justify-around text-[10px] font-medium transition ${
          isLightMode
            ? 'bg-white/85 border-slate-200 text-slate-600 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]'
            : 'bg-[#101014]/80 border-white/10 text-zinc-400 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]'
        }`}>
          <button
            onClick={() => setActiveNav('library')}
            className={`flex flex-col items-center gap-1 transition ${
              activeNav === 'library'
                ? (isLightMode ? 'text-orange-600 font-bold' : 'text-orange-400 font-semibold')
                : (isLightMode ? 'hover:text-slate-900' : 'hover:text-zinc-200')
            }`}
          >
            <ListMusic className="w-4 h-4" />
            <span>Library</span>
          </button>
          <button
            onClick={() => setIsEqOpen(true)}
            className={`flex flex-col items-center gap-1 transition ${
              isLightMode ? 'hover:text-slate-900' : 'hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Equalizer</span>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`flex flex-col items-center gap-1 transition ${
              isLightMode ? 'hover:text-slate-900' : 'hover:text-zinc-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>
      )}

      {/* MODALS */}
      <FullScreenPlayer
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={handlePlayPause}
        onSeek={(s) => audioEngine.seek(s)}
        onPrev={handlePrevTrack}
        onNext={handleNextTrack}
        onToggleLike={handleToggleLike}
        onOpenEq={() => setIsEqOpen(true)}
        onOpenShare={(t) => handleOpenSharePlaylist({
          id: `share-${t.id}`,
          title: t.title,
          description: `${t.artist} · ${t.genre}`,
          trackIds: [t.id],
          coverGradient: 'from-zinc-800 to-zinc-950',
          createdAt: new Date().toISOString(),
        })}
        isSmartShuffleActive={isSmartShuffleActive}
        onToggleSmartShuffle={handleToggleSmartShuffle}
        smartShuffleRationale={smartShuffleRationale}
        currentMood={currentMood}
        onChangeMood={setCurrentMood}
        queue={queue}
        onSelectQueueTrack={handleSelectTrack}
        repeatMode={repeatMode}
        onToggleRepeat={() => {
          const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
          const next = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
          setRepeatMode(next);
        }}
        onToggleOfflineCache={handleToggleOfflineCache}
        onUpdateSyncOffset={handleUpdateTrackSyncOffset}
        isLightMode={isLightMode}
        onToggleTheme={handleToggleTheme}
      />

      <EqualizerDrawer
        isOpen={isEqOpen}
        onClose={() => setIsEqOpen(false)}
        settings={equalizer}
        onChange={(newSettings) => {
          setEqualizer(newSettings);
          offlineStorage.setKV('equalizer_settings', newSettings);
        }}
        isPlaying={isPlaying}
      />

      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onTracksAdded={handleTracksAdded}
      />

      <AiCuratorModal
        isOpen={isAiCuratorOpen}
        onClose={() => setIsAiCuratorOpen(false)}
        libraryTracks={tracks}
        preferences={preferences}
        onAddPlaylists={(newPls) => {
          setPlaylists([...newPls, ...playlists]);
          offlineStorage.savePlaylists([...newPls, ...playlists]);
        }}
        onAddFolders={(newFlds) => {
          setFolders([...newFlds, ...folders]);
          offlineStorage.saveFolders([...newFlds, ...folders]);
        }}
      />

      <SmartPlaylistMakerModal
        isOpen={isSmartPlaylistMakerOpen}
        onClose={() => setIsSmartPlaylistMakerOpen(false)}
        libraryTracks={tracks}
        onAddPlaylists={(newPls) => {
          setPlaylists([...newPls, ...playlists]);
          offlineStorage.savePlaylists([...newPls, ...playlists]);
          setCleanFeedback(`Added ${newPls.length} smart playlist${newPls.length === 1 ? '' : 's'} to Collections!`);
          setTimeout(() => setCleanFeedback(null), 4000);
        }}
        onPlayPlaylist={(trackIds, title) => {
          handlePlayPlaylist(trackIds, title);
          setIsSmartPlaylistMakerOpen(false);
        }}
      />

      <SocialShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        playlist={selectedPlaylistForShare}
        tracks={tracks}
      />

      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
        preferences={preferences}
        onUpdatePreferences={(p) => {
          setPreferences(p);
          offlineStorage.setKV('user_preferences', p);
        }}
        playlists={playlists}
        tracks={tracks}
        equalizer={equalizer}
        stats={stats}
        onRestoreProfile={(restored: any) => {
          if (restored.tracks) setTracks(restored.tracks);
          if (restored.playlists) setPlaylists(restored.playlists);
          if (restored.folders) setFolders(restored.folders);
          if (restored.preferences) setPreferences(restored.preferences);
        }}
        onSyncCloudTracks={(newTracks) => {
          const combined = [...newTracks, ...tracks];
          setTracks(combined);
          setQueue((prev) => [...newTracks, ...prev]);
          offlineStorage.saveTracks(combined).catch(() => {});
        }}
        onSelectTrack={(t) => handleSelectTrack(t)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={handlePlayPause}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onSeek={(s) => audioEngine.seek(s)}
        onToggleLike={handleToggleLike}
        onOpenPlayer={() => setIsFullScreenOpen(true)}
        onOpenEq={() => setIsEqOpen(true)}
        isFloatingWidgetActive={isFloatingWidgetActive}
        onToggleFloatingWidget={() => setIsFloatingWidgetActive(!isFloatingWidgetActive)}
        activeWidgetStyle={activeWidgetStyle}
        onChangeWidgetStyle={setActiveWidgetStyle}
        preferences={preferences}
        onUpdatePreferences={(p) => {
          setPreferences(p);
          offlineStorage.setKV('user_preferences', p);
        }}
        equalizer={equalizer}
        onOpenUpload={() => setIsUploadOpen(true)}
        onClearLibrary={handleClearLibrary}
      />
    </div>
  );
}
