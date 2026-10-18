import { Playlist, Track } from '../types/music';

export class ExportService {
  /**
   * Export playlist as a standard downloadable .m3u playlist file
   */
  static exportToM3U(playlist: Playlist, tracks: Track[]): void {
    const playlistTracks = playlist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => Boolean(t));

    let m3uContent = '#EXTM3U\n';
    m3uContent += `#PLAYLIST:${playlist.title}\n`;
    m3uContent += `#EXTINF:${playlist.description}\n\n`;

    playlistTracks.forEach((t) => {
      m3uContent += `#EXTINF:${Math.round(t.duration)},${t.artist} - ${t.title}\n`;
      m3uContent += `${t.title.replace(/\s+/g, '_')}_${t.artist.replace(/\s+/g, '_')}.mp3\n`;
    });

    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${playlist.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.m3u`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export playlist as JSON configuration
   */
  static exportToJson(playlist: Playlist, tracks: Track[]): void {
    const playlistTracks = playlist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => Boolean(t));

    const exportData = {
      vettify_version: '1.0',
      exportedAt: new Date().toISOString(),
      playlist: {
        title: playlist.title,
        description: playlist.description,
        coverGradient: playlist.coverGradient,
        coverEmoji: playlist.coverEmoji,
        tracks: playlistTracks.map((t) => ({
          title: t.title,
          artist: t.artist,
          album: t.album,
          genre: t.genre,
          mood: t.mood,
          duration: t.duration,
        })),
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${playlist.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Vettify.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export to Spotify:
   * Generates formatted text search queries or opens Spotify search
   */
  static openSpotifySearch(trackTitle: string, artist: string): void {
    const query = encodeURIComponent(`${trackTitle} ${artist}`);
    window.open(`https://open.spotify.com/search/${query}`, '_blank');
  }

  /**
   * Export to YouTube Music
   */
  static openYouTubeMusicSearch(trackTitle: string, artist: string): void {
    const query = encodeURIComponent(`${trackTitle} ${artist}`);
    window.open(`https://music.youtube.com/search?q=${query}`, '_blank');
  }

  /**
   * Export to Apple Music
   */
  static openAppleMusicSearch(trackTitle: string, artist: string): void {
    const query = encodeURIComponent(`${trackTitle} ${artist}`);
    window.open(`https://music.apple.com/us/search?term=${query}`, '_blank');
  }

  /**
   * Native Share API or Clipboard Copy
   */
  static async sharePlaylist(playlist: Playlist, tracksCount: number): Promise<boolean> {
    const shareText = `🎵 Listen to "${playlist.title}" on Vettify Music Player!\n✨ ${playlist.description}\n🎧 ${tracksCount} curated tracks • AI Smart Curated`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: playlist.title,
          text: shareText,
          url: window.location.href,
        });
        return true;
      } catch (e) {
        // user cancelled or failed, fallback to copy
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Generates a unique 6-character cloud sync / share code
   */
  static generateSyncCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'VET-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
