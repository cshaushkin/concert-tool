import React, { useState } from "react";
import { motion } from "framer-motion";

export default function ConcertQueryTool() {
  const [view, setView] = useState("search");
  const [searchMode, setSearchMode] = useState("artist");
  const [query, setQuery] = useState("");
  const [spotifyToken, setSpotifyToken] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch Spotify token
  const fetchSpotifyToken = async () => {
    try {
      const response = await fetch("/api/spotify-token");
      if (!response.ok) throw new Error("Failed to fetch Spotify token");
      const data = await response.json();
      setSpotifyToken(data.access_token);
    } catch (error) {
      console.error("Error fetching Spotify token:", error);
      alert("Failed to load Spotify token. Please try again.");
    }
  };

  // Fetch additional track details from Spotify
  const fetchSpotifyTrackDetails = async (trackId) => {
    try {
      const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      });
      const trackData = await trackResponse.json();

      const audioFeaturesResponse = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      });
      const audioFeaturesData = await audioFeaturesResponse.json();

      return {
        albumArt: trackData.album.images[0]?.url, // Highest resolution album art
        popularity: trackData.popularity,
        audioFeatures: {
          danceability: audioFeaturesData.danceability,
          energy: audioFeaturesData.energy,
          tempo: audioFeaturesData.tempo,
          key: audioFeaturesData.key,
          mode: audioFeaturesData.mode,
        },
      };
    } catch (error) {
      console.error("Error fetching Spotify track details:", error);
      return null;
    }
  };

  // Fetch artist details from Spotify
  const fetchSpotifyArtistDetails = async (artistId) => {
    try {
      const artistResponse = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      });
      const artistData = await artistResponse.json();

      const relatedArtistsResponse = await fetch(`https://api.spotify.com/v1/artists/${artistId}/related-artists`, {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      });
      const relatedArtistsData = await relatedArtistsResponse.json();

      return {
        genres: artistData.genres,
        followers: artistData.followers.total,
        relatedArtists: relatedArtistsData.artists.map((artist) => artist.name),
      };
    } catch (error) {
      console.error("Error fetching Spotify artist details:", error);
      return null;
    }
  };

  // Fetch lyrics using Lyrics.ovh API
  const fetchLyrics = async (artist, title) => {
    try {
      const response = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`);
      const data = await response.json();
      return data.lyrics || "Lyrics not found.";
    } catch (error) {
      console.error("Error fetching lyrics:", error);
      return "Lyrics not available.";
    }
  };

  // Fetch release information from MusicBrainz
  const fetchMusicBrainzReleaseInfo = async (releaseId) => {
    try {
      const response = await fetch(`https://musicbrainz.org/ws/2/release/${releaseId}?fmt=json`, {
        headers: { "User-Agent": "ConcertQueryTool/1.0 (your-email@example.com)" },
      });
      const data = await response.json();
      return {
        releaseType: data["release-group"]?.["primary-type"] || "Unknown",
        tracklist: data.media?.[0]?.tracks?.map((track) => track.title) || [],
        label: data["label-info"]?.[0]?.label?.name || "Unknown",
        catalogNumber: data["label-info"]?.[0]?.["catalog-number"] || "N/A",
      };
    } catch (error) {
      console.error("Error fetching MusicBrainz release info:", error);
      return null;
    }
  };

  // Fetch MusicBrainz info
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
      const releaseInfo = await fetchMusicBrainzReleaseInfo(release.id);

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
        releaseInfo,
      };
    } catch (error) {
      console.error("Error fetching MusicBrainz data:", error);
      return null;
    }
  };

  // Fetch PRO info
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

  // Handle search
  const handleSearch = async () => {
    if (!spotifyToken) {
      alert("Spotify token not loaded. Click 'Load Token' first.");
      return;
    }

    setIsLoading(true);
    try {
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
        const artistDetails = await fetchSpotifyArtistDetails(artist.id);
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
            const spotifyDetails = await fetchSpotifyTrackDetails(track.id);
            const lyrics = await fetchLyrics(artist.name, track.name);
            return { ...track, mbInfo, spotifyDetails, lyrics, artistDetails };
          })
        );

        setResults(enrichedTracks);
      } else {
        const enrichedTracks = await Promise.all(
          data.tracks.items.map(async (track) => {
            const mbInfo = await fetchMusicBrainzInfo(track.name, track.artists[0].name);
            const spotifyDetails = await fetchSpotifyTrackDetails(track.id);
            const lyrics = await fetchLyrics(track.artists[0].name, track.name);
            return { ...track, mbInfo, spotifyDetails, lyrics };
          })
        );

        setResults(enrichedTracks);
      }

      setView("results");
    } catch (error) {
      console.error("Error during search:", error);
      alert("An error occurred while fetching data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "auto", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px", color: "#1DB954" }}>
        🎧 Music Metadata Tool
      </h1>
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={fetchSpotifyToken}
          style={{ padding: "10px", marginRight: "10px", backgroundColor: "#1DB954", color: "white", border: "none", borderRadius: "5px" }}
        >
          Load Token
        </button>
        <input
          type="text"
          placeholder={`Enter ${searchMode}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: "10px", marginRight: "10px", width: "300px", borderRadius: "5px", border: "1px solid #ccc" }}
        />
        <button
          onClick={handleSearch}
          style={{ padding: "10px", backgroundColor: "#1DB954", color: "white", border: "none", borderRadius: "5px" }}
        >
          Search
        </button>
      </div>
      {isLoading && <p>Loading...</p>}
      {view === "results" && (
        <div>
          <button
            onClick={() => setView("search")}
            style={{ padding: "10px", marginBottom: "20px", backgroundColor: "#1DB954", color: "white", border: "none", borderRadius: "5px" }}
          >
            Back to Search
          </button>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#1DB954", color: "white" }}>
                <th style={{ padding: "10px", textAlign: "left" }}>Track</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Album Art</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Spotify ISRC</th>
                <th style={{ padding: "10px", textAlign: "left" }}>MusicBrainz ISRC</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Writers</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Publishers</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Popularity</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Genres</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Lyrics</th>
              </tr>
            </thead>
            <tbody>
              {results.map((track, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  style={{ borderBottom: "1px solid #ccc" }}
                >
                  <td style={{ padding: "10px" }}>{track.name}</td>
                  <td style={{ padding: "10px" }}>
                    <img src={track.spotifyDetails?.albumArt} alt="Album Art" style={{ width: "50px" }} />
                  </td>
                  <td style={{ padding: "10px" }}>{track.external_ids?.isrc || "N/A"}</td>
                  <td style={{ padding: "10px" }}>{track.mbInfo?.musicBrainzISRC || "N/A"}</td>
                  <td style={{ padding: "10px" }}>{track.mbInfo?.proInfo?.writers.join(", ") || "N/A"}</td>
                  <td style={{ padding: "10px" }}>{track.mbInfo?.proInfo?.publishers.join(", ") || "N/A"}</td>
                  <td style={{ padding: "10px" }}>{track.spotifyDetails?.popularity || "N/A"}</td>
                  <td style={{ padding: "10px" }}>{track.artistDetails?.genres.join(", ") || "N/A"}</td>
                  <td style={{ padding: "10px" }}>{track.lyrics || "N/A"}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}