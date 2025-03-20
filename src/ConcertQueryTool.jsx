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

  const fetchMusicBrainzInfo = async (title, artistName) => {
    try {
      const query = `recording:"${title}" AND artist:"${artistName}"`;
      const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=1&inc=artist-credits+releases+labels`;

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
      const label = release?.label-info?.[0]?.label?.name || "Unknown Label";
      const copyright = release?.disambiguation || "Unknown © Info";

      return {
        artist,
        album: releaseTitle,
        year: releaseDate,
        duration: durationFormatted,
        label,
        copyright,
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
          return { ...track, mbInfo };
        })
      );

      setResults(enrichedTracks);
    } else {
      const enrichedTracks = await Promise.all(
        data.tracks.items.map(async (track) => {
          const mbInfo = await fetchMusicBrainzInfo(track.name, track.artists[0].name);
          return { ...track, mbInfo };
        })
      );

      setResults(enrichedTracks);
    }

    setView("results");
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "auto" }}>
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
          <ul style={{ listStyle: "none", padding: 0 }}>
            {results.map((track, index) => (
              <motion.li
                key={index}
                style={{ marginBottom: "20px", border: "1px solid #ccc", padding: "10px", borderRadius: "10px" }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <strong>{track.name}</strong> by {track.artists[0].name}
                <p>🆔 ISRC: {track.external_ids?.isrc || "N/A"}</p>
                <p>
                  <a href={track.external_urls.spotify} target="_blank" rel="noopener noreferrer">
                    Open in Spotify
                  </a>
                </p>
                {track.preview_url ? (
                  <audio controls src={track.preview_url} style={{ width: "100%" }} />
                ) : (
                  <p>No preview available</p>
                )}
                {track.mbInfo && (
                  <div style={{ marginTop: "10px", fontSize: "14px" }}>
                    <p>🎤 Artist: {track.mbInfo.artist}</p>
                    <p>💿 Album: {track.mbInfo.album} ({track.mbInfo.year})</p>
                    <p>⏱️ Duration: {track.mbInfo.duration}</p>
                    <p>℗ Label (P Line): {track.mbInfo.label}</p>
                    <p>© Copyright (C Line): {track.mbInfo.copyright}</p>
                    <a href={track.mbInfo.musicBrainzUrl} target="_blank" rel="noopener noreferrer">
                      View on MusicBrainz
                    </a>
                  </div>
                )}
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
