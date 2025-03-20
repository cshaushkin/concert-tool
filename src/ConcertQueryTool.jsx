import React, { useState } from "react";
import { motion } from "framer-motion";

export default function ConcertQueryTool() {
  const [searchMode, setSearchMode] = useState("track"); // 'track' or 'isrc'
  const [query, setQuery] = useState("");
  const [spotifyToken, setSpotifyToken] = useState("");
  const [concerts, setConcerts] = useState([]);

  const fetchSpotifyToken = async () => {
    try {
      const response = await fetch("/api/spotify-token");
      const data = await response.json();
      setSpotifyToken(data.access_token);
    } catch (error) {
      console.error("Error fetching Spotify token:", error);
    }
  };

  const fetchMusicBrainzArtistInfo = async (artistName) => {
    try {
      const url = `https://musicbrainz.org/ws/2/artist/?query=artist:"${encodeURIComponent(artistName)}"&fmt=json&limit=1`;
      const response = await fetch(url, {
        headers: { "User-Agent": "ConcertQueryTool/1.0 (your-email@example.com)" },
      });
      const data = await response.json();
      const artist = data.artists?.[0];
      if (!artist) return null;

      const country = artist.area?.name || "Unknown";
      const birth = artist["life-span"]?.begin || "Unknown";
      const death = artist["life-span"]?.ended ? artist["life-span"].end : "Present";

      const relUrl = `https://musicbrainz.org/ws/2/artist/${artist.id}?inc=url-rels&fmt=json`;
      const relRes = await fetch(relUrl, {
        headers: { "User-Agent": "ConcertQueryTool/1.0 (your-email@example.com)" },
      });
      const relData = await relRes.json();
      const urls = relData.relations || [];

      const wikipedia = urls.find((r) => r.type === "wikipedia")?.url?.resource || null;
      const discogs = urls.find((r) => r.type === "discogs")?.url?.resource || null;

      return { country, birth, death, wikipedia, discogs };
    } catch (error) {
      console.error("Error fetching MusicBrainz artist info:", error);
      return null;
    }
  };

  const fetchMusicBrainzInfo = async (title, artistName) => {
    try {
      const query = `recording:"${title}" AND artist:"${artistName}"`;
      const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=1`;

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

      return {
        artist,
        album: releaseTitle,
        year: releaseDate,
        duration: durationFormatted,
        musicBrainzUrl: `https://musicbrainz.org/recording/${recording.id}`,
      };
    } catch (error) {
      console.error("Error fetching MusicBrainz data:", error);
      return null;
    }
  };

  const fetchTrackData = async () => {
    try {
      if (!spotifyToken) {
        alert("Spotify token not loaded. Click 'Load Token' first.");
        return;
      }

      let track = null;
      let spotifyArtist = null;

      if (searchMode === "track") {
        // Search by track name
        const searchResponse = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
          {
            headers: { Authorization: `Bearer ${spotifyToken}` },
          }
        );
        const searchData = await searchResponse.json();
        track = searchData.tracks?.items?.[0];
      } else {
        // Search by ISRC
        const isrcResponse = await fetch(
          `https://api.spotify.com/v1/search?q=isrc:${encodeURIComponent(query)}&type=track&limit=1`,
          {
            headers: { Authorization: `Bearer ${spotifyToken}` },
          }
        );
        const isrcData = await isrcResponse.json();
        track = isrcData.tracks?.items?.[0];
      }

      if (!track) {
        console.error("Track not found");
        return;
      }

      spotifyArtist = track.artists?.[0];
      const mbArtistInfo = await fetchMusicBrainzArtistInfo(spotifyArtist.name);
      const mbInfo = await fetchMusicBrainzInfo(track.name, spotifyArtist.name);

      const fakeConcert = {
        date: new Date().toLocaleDateString(),
        venue: `${track.name} Result`,
        setlist: [
          {
            title: track.name,
            audioUrl: track.preview_url || "",
            duration:
              Math.floor(track.duration_ms / 60000) +
              ":" +
              String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, "0"),
            explicit: track.explicit,
            albumArt: track.album.images[0]?.url || "",
            spotifyUrl: track.external_urls.spotify,
            isrc: track.external_ids?.isrc || "N/A",
            mbInfo,
          },
        ],
        artistInfo: {
          name: spotifyArtist.name,
          image: spotifyArtist.images?.[0]?.url || "",
          genres: [], // Not available directly from track data
          followers: 0, // Not available here
          popularity: 0, // Not available here
          spotifyUrl: spotifyArtist.external_urls.spotify,
          mbInfo: mbArtistInfo,
        },
      };

      setConcerts([fakeConcert]);
    } catch (error) {
      console.error("Error fetching track data:", error);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" }}>
        🎧 Music Metadata Query Tool
      </h1>

      <div style={{ marginBottom: "10px" }}>
        <button onClick={fetchSpotifyToken}>Load Token</button>
        <span style={{ marginLeft: "10px", color: "green" }}>
          {spotifyToken ? "Token Loaded ✔️" : "No token yet"}
        </span>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label>
          <input
            type="radio"
            value="track"
            checked={searchMode === "track"}
            onChange={() => setSearchMode("track")}
          />
          Search by Track Name
        </label>
        <label style={{ marginLeft: "20px" }}>
          <input
            type="radio"
            value="isrc"
            checked={searchMode === "isrc"}
            onChange={() => setSearchMode("isrc")}
          />
          Search by ISRC
        </label>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder={searchMode === "track" ? "Enter track name..." : "Enter ISRC..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginRight: "10px", width: "60%" }}
        />
        <button onClick={fetchTrackData}>Search</button>
      </div>

      {concerts.map((concert, index) => (
        <motion.div
          key={index}
          style={{
            border: "1px solid #ccc",
            borderRadius: "10px",
            padding: "10px",
            marginBottom: "15px",
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: "bold" }}>
            {concert.date} - {concert.venue}
          </h2>

          {concert.artistInfo && (
            <div style={{ textAlign: "center", marginBottom: "15px" }}>
              <h3>{concert.artistInfo.name}</h3>
              <a href={concert.artistInfo.spotifyUrl} target="_blank" rel="noopener noreferrer">
                Open Artist on Spotify
              </a>
              {concert.artistInfo.mbInfo && (
                <div style={{ fontSize: "14px", marginTop: "5px" }}>
                  <p>🌍 Country: {concert.artistInfo.mbInfo.country}</p>
                  <p>📅 Life Span: {concert.artistInfo.mbInfo.birth} - {concert.artistInfo.mbInfo.death}</p>
                  {concert.artistInfo.mbInfo.wikipedia && (
                    <p>
                      📖 <a href={concert.artistInfo.mbInfo.wikipedia} target="_blank" rel="noopener noreferrer">Wikipedia</a>
                    </p>
                  )}
                  {concert.artistInfo.mbInfo.discogs && (
                    <p>
                      💿 <a href={concert.artistInfo.mbInfo.discogs} target="_blank" rel="noopener noreferrer">Discogs</a>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <ul style={{ marginTop: "10px", listStyle: "none", paddingLeft: 0 }}>
            {concert.setlist.map((song, i) => (
              <li key={i} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <img
                    src={song.albumArt}
                    alt="Album Art"
                    style={{ width: "60px", borderRadius: "5px", marginRight: "10px" }}
                  />
                  <div>
                    <strong>{song.title}</strong>{" "}
                    {song.explicit && <span style={{ color: "red", marginLeft: "5px" }}>🔞 Explicit</span>}
                    <p style={{ margin: 0 }}>Spotify Duration: {song.duration}</p>
                    <p style={{ margin: 0 }}>🆔 ISRC: {song.isrc}</p>
                    <a href={song.spotifyUrl} target="_blank" rel="noopener noreferrer">
                      Open in Spotify
                    </a>
                    <br />
                    {song.audioUrl ? (
                      <audio controls src={song.audioUrl} style={{ marginTop: "5px", width: "250px" }} />
                    ) : (
                      <span style={{ color: "gray" }}>No preview available</span>
                    )}
                    {song.mbInfo && (
                      <div style={{ marginTop: "5px", fontSize: "14px", color: "#333" }}>
                        <p style={{ margin: 0 }}>🎤 Artist: {song.mbInfo.artist}</p>
                        <p style={{ margin: 0 }}>💿 Album: {song.mbInfo.album} ({song.mbInfo.year})</p>
                        <p style={{ margin: 0 }}>⏱️ MusicBrainz Duration: {song.mbInfo.duration}</p>
                        <a href={song.mbInfo.musicBrainzUrl} target="_blank" rel="noopener noreferrer">
                          View on MusicBrainz
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}
