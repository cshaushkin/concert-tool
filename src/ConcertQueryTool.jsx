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
        duration:
          Math.floor(track.duration_ms / 60000) +
          ":" +
          String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, "0"),
        explicit: track.explicit,
        albumArt: track.album.images[0]?.url || "",
        spotifyUrl: track.external_urls.spotify,
      }));

      const artistInfo = {
        name: spotifyArtist.name,
        image: spotifyArtist.images[0]?.url || "",
        genres: spotifyArtist.genres || [],
        followers: spotifyArtist.followers.total || 0,
        popularity: spotifyArtist.popularity || 0,
        spotifyUrl: spotifyArtist.external_urls.spotify,
      };

      const fakeConcert = {
        date: new Date().toLocaleDateString(),
        venue: `${spotifyArtist.name} Top Tracks`,
        setlist: topTracks,
        artistInfo,
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

      {concerts.length > 0 && concerts[0].artistInfo && (
        <motion.div
          style={{
            textAlign: "center",
            marginBottom: "30px",
            padding: "15px",
            border: "1px solid #ddd",
            borderRadius: "10px",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <img
            src={concerts[0].artistInfo.image}
            alt="Artist"
            style={{ width: "150px", borderRadius: "8px", marginBottom: "10px" }}
          />
          <h2>{concerts[0].artistInfo.name}</h2>
          <p>Genres: {concerts[0].artistInfo.genres.join(", ") || "N/A"}</p>
          <p>Followers: {concerts[0].artistInfo.followers.toLocaleString()}</p>
          <p>Popularity: {concerts[0].artistInfo.popularity}/100</p>
          <a
            href={concerts[0].artistInfo.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on Spotify
          </a>
        </motion.div>
      )}

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
            <ul style={{ marginTop: "10px", listStyle: "none", paddingLeft: 0 }}>
              {concert.setlist.map((song, i) => (
                <li key={i} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <img
                      src={song.albumArt}
                      alt="Album Art"
                      style={{
                        width: "60px",
                        borderRadius: "5px",
                        marginRight: "10px",
                      }}
                    />
                    <div>
                      <strong>{song.title}</strong>{" "}
                      {song.explicit && (
                        <span style={{ color: "red", marginLeft: "5px" }}>🔞 Explicit</span>
                      )}
                      <p style={{ margin: 0 }}>Duration: {song.duration}</p>
                      <a
                        href={song.spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in Spotify
                      </a>
                      <br />
                      {song.audioUrl ? (
                        <audio
                          controls
                          src={song.audioUrl}
                          style={{ marginTop: "5px", width: "250px" }}
                        />
                      ) : (
                        <span style={{ color: "gray" }}>No preview available</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
