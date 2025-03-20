import React, { useState } from "react";
import { motion } from "framer-motion";

export default function ConcertQueryTool() {
  const [artist, setArtist] = useState("");
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

  const fetchConcerts = async () => {
    try {
      if (!spotifyToken) {
        alert("Spotify token not loaded. Click 'Load Token' first.");
        return;
      }

      const artistResponse = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artist)}&fmt=json`,
        {
          headers: {
            "User-Agent": "ConcertQueryTool/1.0 (your-email@example.com)",
          },
        }
      );

      const artistData = await artistResponse.json();
      const artistId = artistData.artists[0]?.id;
      const artistName = artistData.artists[0]?.name;
      if (!artistId) {
        console.error("Artist not found");
        return;
      }

      const eventResponse = await fetch(
        `https://musicbrainz.org/ws/2/event?artist=${artistId}&fmt=json`,
        {
          headers: {
            "User-Agent": "ConcertQueryTool/1.0 (your-email@example.com)",
          },
        }
      );

      const eventData = await eventResponse.json();

      const parsedConcerts = await Promise.all(
        (eventData.events || []).map(async (event) => {
          const songTitles = ["Sample Song 1", "Sample Song 2"];

          const setlistWithAudio = await Promise.all(
            songTitles.map(async (title) => {
              const spotifyResponse = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(`${title} ${artistName}`)}&type=track&limit=1`,
                {
                  headers: {
                    Authorization: `Bearer ${spotifyToken}`,
                  },
                }
              );
              const spotifyData = await spotifyResponse.json();
              const previewUrl = spotifyData.tracks?.items[0]?.preview_url || "";

              return {
                title,
                audioUrl: previewUrl || "",
              };
            })
          );

          return {
            date: event.time || "Unknown Date",
            venue: event.venue?.name || "Unknown Venue",
            setlist: setlistWithAudio,
          };
        })
      );

      setConcerts(parsedConcerts);
    } catch (error) {
      console.error("Error fetching data from MusicBrainz or Spotify:", error);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" }}>
        🎸 Live Concert Query Tool
      </h1>

      <div style={{ marginBottom: "10px" }}>
        <button onClick={fetchSpotifyToken}>Load Token</button>
        <input
          type="text"
          placeholder="Spotify Token (auto-loaded)..."
          value={spotifyToken}
          onChange={(e) => setSpotifyToken(e.target.value)}
          style={{ marginLeft: "10px", width: "60%" }}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Enter artist name..."
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          style={{ marginRight: "10px", width: "60%" }}
        />
        <button onClick={fetchConcerts}>Search</button>
      </div>

      <div>
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
            <ul style={{ marginTop: "10px" }}>
              {concert.setlist.map((song, i) => (
                <li key={i} style={{ marginBottom: "5px" }}>
                  <strong>{song.title}</strong>
                  {song.audioUrl ? (
                    <audio controls src={song.audioUrl} style={{ marginLeft: "10px" }} />
                  ) : (
                    <span style={{ marginLeft: "10px", color: "gray" }}>No preview available</span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
