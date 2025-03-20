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

      // Search Spotify for the artist ID
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(artist)}&type=artist&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${spotifyToken}`,
          },
        }
      );
      const searchData = await searchResponse.json();
      const spotifyArtist = searchData.artists.items[0];

      if (!spotifyArtist) {
        console.error("Artist not found on Spotify");
        return;
      }

      const spotifyArtistId = spotifyArtist.id;

      // Get top tracks for the artist
      const topTracksResponse = await fetch(
        `https://api.spotify.com/v1/artists/${spotifyArtistId}/top-tracks?market=US`,
        {
          headers: {
            Authorization: `Bearer ${spotifyToken}`,
          },
        }
      );
      const topTracksData = await topTracksResponse.json();

      const topTracks = (topTracksData.tracks || []).slice(0, 5).map((track) => ({
        title: track.name,
        audioUrl: track.preview_url || "",
      }));

      // Create a fake concert card with top tracks
      const fakeConcert = {
        date: new Date().toLocaleDateString(),
        venue: `${spotifyArtist.name} Top Tracks`,
        setlist: topTracks,
      };

      setConcerts([fakeConcert]);
    } catch (error) {
      console.error("Error fetching data from Spotify:", error);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" }}>
        🎸 Live Concert Query Tool
      </h1>

      <div style={{ marginBottom: "10px" }}>
        <button onClick={fetchSpotifyToken}>Load Token</button>
        <span style={{ marginLeft: "10px", color: "green" }}>
          {spotifyToken ? "Token Loaded ✔️" : "No token yet"}
        </span>
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
