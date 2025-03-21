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

      const proInfo = await fetchPROInfo(musicBrainzISRC);

      return {
        artist,
        album: releaseTitle,
        year: releaseDate,
        duration: durationFormatted,
        label,
        copyright,
        musicBrainzISRC,
        musicBrainzUrl: `https://musicbrainz.org/recording/${recording.id}`,
        proInfo,
      };
    } catch (error) {
      console.error("Error fetching MusicBrainz data:", error);
      return null;
    }
  };

  const fetchPROInfo = async (isrc) => {
    if (!isrc) return null;
    try {
      const url = `https://musicbrainz.org/ws/2/isrc/${isrc}?inc=recordings+artist-credits+work-rels+url-rels&fmt=json`;
      const response = await fetch(url, {
        headers: { "User-Agent": "ConcertQueryTool/1.0 (your-email@example.com)" },
      });
      const data = await response.json();

      const work = data.isrc?.recordings?.[0]?.works?.[0];
      if (!work) return null;

      const relationships = work.relations || [];
      const writers = relationships
        .filter((rel) => rel.type === "composer" || rel.type === "lyricist")
        .map((rel) => rel.artist?.name);

      const publishers = relationships
        .filter((rel) => rel.type === "publisher")
        .map((rel) => rel.artist?.name);

      return {
        writers: writers.length ? writers : ["Unknown"],
        publishers: publishers.length ? publishers : ["Unknown"],
      };
    } catch (error) {
      console.error("Error fetching PRO info:", error);
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
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" }}>
        🎧 Music Metadata Tool
      </h1>
      <div>
        <button onClick={fetchSpotifyToken}>Load Token</button>
        <input
          type="text"
          placeholder={`Enter ${searchMode}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={handleSearch}>Search</button>
      </div>
      {view === "results" && (
        <table>
          <thead>
            <tr>
              <th>Track</th>
              <th>Spotify ISRC</th>
              <th>MusicBrainz ISRC</th>
              <th>Writers</th>
              <th>Publishers</th>
            </tr>
          </thead>
          <tbody>
            {results.map((track, index) => (
              <tr key={index}>
                <td>{track.name}</td>
                <td>{track.external_ids?.isrc || "N/A"}</td>
                <td>{track.mbInfo?.musicBrainzISRC || "N/A"}</td>
                <td>{track.mbInfo?.proInfo?.writers.join(", ") || "N/A"}</td>
                <td>{track.mbInfo?.proInfo?.publishers.join(", ") || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
