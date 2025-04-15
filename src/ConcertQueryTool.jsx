import React, { useState } from "react";
import { motion } from "framer-motion";

export default function ConcertQueryTool() {
  const [view, setView] = useState("search");
  const [searchMode, setSearchMode] = useState("artist");
  const [query, setQuery] = useState("");
  const [spotifyToken, setSpotifyToken] = useState("");
  const [results, setResults] = useState([]);

  const fetchSpotifyToken = async () => {
    try {
      const response = await fetch("/api/spotify-token");
      const data = await response.json();
      setSpotifyToken(data.access_token);
    } catch (error) {
      console.error("Error fetching Spotify token:", error);
    }
  };

  const fetchAudioFeatures = async (trackId) => {
    try {
      const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching audio features:", error);
      return null;
    }
  };

  const fetchMusicBrainzInfo = async (title, artistName) => {
    try {
      const query = `recording:"${title}" AND artist:"${artistName}"`;
      const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=1&inc=artist-credits+releases+labels+isrcs`;

      const response = await fetch(url, {
        headers: { "User-Agent": "ConcertQueryTool/1.0 (your-email@example.com)" },
      });

      const data = await response.json();
      const recording = data.recordings?.[0];
      if (!recording) return null;

      const durationMs = recording.length;
      const durationFormatted = durationMs
        ? Math.floor(durationMs / 60000) + ":" + String(Math.floor((durationMs % 60000) / 1000)).padStart(2, "0")
        : "N/A";

      const release = recording.releases?.[0];
      const releaseTitle = release?.title || "Unknown Album";
      const releaseDate = release?.date ? release.date.split("-")[0] : "Unknown Year";
      const artist = recording["artist-credit"]?.[0]?.name || artistName;
      const label = release?.["label-info"]?.[0]?.label?.name || "Unknown Label";
      const copyright = release?.disambiguation || "Unknown © Info";
      const musicBrainzISRC = recording.isrcs?.[0] || "N/A";

      return {
        artist,
        album: releaseTitle,
        year: releaseDate,
        duration: durationFormatted,
        label,
        copyright,
        musicBrainzISRC,
        musicBrainzUrl: `https://musicbrainz.org/recording/${recording.id}`,
      };
    } catch (error) {
      console.error("Error fetching MusicBrainz data:", error);
      return null;
    }
  };

  const handleSearch = async () => {
    if (!spotifyToken) {
      alert("Spotify token not loaded. Click 'Load Token' first.");
      return;
    }

    const queryParam = searchMode === "isrc" ? `isrc:${query}` : query;
    const type = searchMode === "artist" ? "artist" : "track";

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(queryParam)}&type=${type}&limit=5`,
      {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      }
    );

    const data = await response.json();

    if (searchMode === "artist") {
      const artist = data.artists.items[0];
      const topTracksRes = await fetch(
        `https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=US`,
        {
          headers: { Authorization: `Bearer ${spotifyToken}` },
        }
      );
      const topTracksData = await topTracksRes.json();

      const enrichedTracks = await Promise.all(
        topTracksData.tracks.map(async (track) => {
          const mbInfo = await fetchMusicBrainzInfo(track.name, artist.name);
          const audioFeatures = await fetchAudioFeatures(track.id);
          return { ...track, mbInfo, audioFeatures };
        })
      );

      setResults(enrichedTracks);
    } else {
      const enrichedTracks = await Promise.all(
        data.tracks.items.map(async (track) => {
          const mbInfo = await fetchMusicBrainzInfo(track.name, track.artists[0].name);
          const audioFeatures = await fetchAudioFeatures(track.id);
          return { ...track, mbInfo, audioFeatures };
        })
      );

      setResults(enrichedTracks);
    }

    setView("results");
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" }}>
        🎧 Music Metadata Tool
      </h1>

      {view === "search" && (
        <>
          <button onClick={fetchSpotifyToken}>Load Token</button>
          <span style={{ marginLeft: "10px", color: "green" }}>
            {spotifyToken ? "Token Loaded ✔️" : "No token yet"}
          </span>

          <div style={{ marginTop: "10px" }}>
            <label>
              <input
                type="radio"
                value="artist"
                checked={searchMode === "artist"}
                onChange={() => setSearchMode("artist")}
              />
              Artist
            </label>
            <label style={{ marginLeft: "20px" }}>
              <input
                type="radio"
                value="track"
                checked={searchMode === "track"}
                onChange={() => setSearchMode("track")}
              />
              Track Name
            </label>
            <label style={{ marginLeft: "20px" }}>
              <input
                type="radio"
                value="isrc"
                checked={searchMode === "isrc"}
                onChange={() => setSearchMode("isrc")}
              />
              ISRC
            </label>
          </div>

          <div style={{ marginTop: "10px" }}>
            <input
              type="text"
              placeholder={`Enter ${searchMode}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ marginRight: "10px", width: "60%" }}
            />
            <button onClick={handleSearch}>Search</button>
          </div>
        </>
      )}

      {view === "results" && (
        <>
          <button onClick={() => setView("search")}>⬅ Back</button>
          <h2>Results</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ padding: "8px", border: "1px solid #ccc" }}>Album Art</th>
                <th style={{ padding: "8px", border: "1px solid #ccc" }}>Track Info</th>
                <th style={{ padding: "8px", border: "1px solid #ccc" }}>Spotify Duration</th>
                <th style={{ padding: "8px", border: "1px solid #ccc" }}>Audio Features</th>
                <th style={{ padding: "8px", border: "1px solid #ccc" }}>MusicBrainz Info</th>
              </tr>
            </thead>
            <tbody>
              {results.map((track, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ borderBottom: "1px solid #ccc" }}
                >
                  <td style={{ padding: "8px", border: "1px solid #ccc", textAlign: "center" }}>
                    <img
                      src={track.album.images[0]?.url}
                      alt="Album Art"
                      style={{ width: "60px", borderRadius: "5px" }}
                    />
                  </td>
                  <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                    <strong>{track.name}</strong>
                    {track.explicit && <span style={{ color: "red", marginLeft: "5px" }}>🔞 Explicit</span>}
                    <p style={{ margin: 0 }}>Artist: {track.artists[0].name}</p>
                    <p style={{ margin: 0 }}>Album: {track.album.name} ({track.album.release_date})</p>
                    <p style={{ margin: 0 }}>Spotify ISRC: {track.external_ids?.isrc || "N/A"}</p>
                    <a href={track.external_urls.spotify} target="_blank" rel="noopener noreferrer">
                      Open in Spotify
                    </a>
                    <br />
                    {track.preview_url ? (
                      <audio controls src={track.preview_url} style={{ marginTop: "5px", width: "200px" }} />
                    ) : (
                      <span style={{ color: "gray" }}>No preview</span>
                    )}
                  </td>
                  <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                    {Math.floor(track.duration_ms / 60000)}:
                    {String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, "0")}
                  </td>
                  <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                    {track.audioFeatures ? (
                      <>
                        <p style={{ margin: 0 }}>🎚️ Danceability: {track.audioFeatures.danceability}</p>
                        <p style={{ margin: 0 }}>⚡ Energy: {track.audioFeatures.energy}</p>
                        <p style={{ margin: 0 }}>🎵 Tempo: {track.audioFeatures.tempo} BPM</p>
                        <p style={{ margin: 0 }}>🎼 Key: {track.audioFeatures.key}</p>
                        <p style={{ margin: 0 }}>🎭 Mode: {track.audioFeatures.mode === 1 ? "Major" : "Minor"}</p>
                      </>
                    ) : (
                      <span style={{ color: "gray" }}>No audio data</span>
                    )}
                  </td>
                  <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                    {track.mbInfo ? (
                      <>
                        <p style={{ margin: 0 }}>Artist: {track.mbInfo.artist}</p>
                        <p style={{ margin: 0 }}>Album: {track.mbInfo.album} ({track.mbInfo.year})</p>
                        <p style={{ margin: 0 }}>Duration: {track.mbInfo.duration}</p>
                        <p style={{ margin: 0 }}>℗ Label: {track.mbInfo.label}</p>
                        <p style={{ margin: 0 }}>©: {track.mbInfo.copyright}</p>
                        <p style={{ margin: 0 }}>MB ISRC: {track.mbInfo.musicBrainzISRC}</p>
                        <a href={track.mbInfo.musicBrainzUrl} target="_blank" rel="noopener noreferrer">
                          View on MusicBrainz
                        </a>
                      </>
                    ) : (
                      <span style={{ color: "gray" }}>No MB info</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
