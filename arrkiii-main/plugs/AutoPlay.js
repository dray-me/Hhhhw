/** @format
 *
 * Arrkiii By Ozuma xd
 * © 2022 Arrkiii Development
 *
 */

function levenshtein(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1,
            );
    }
  }
  return matrix[b.length][a.length];
}

// Normalize song title for comparison
function normalizeSongTitle(title) {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // Remove parentheses
    .replace(/\[.*?\]/g, "") // Remove brackets
    .replace(/feat\.?|ft\.?|featuring|prod\.?|produced/gi, "")
    .replace(/official|video|audio|lyrics|music|mv|hd|4k/gi, "")
    .replace(/remix|remastered|cover|acoustic|live|version/gi, "")
    .replace(/[^\w\s]/g, "") // Remove special chars
    .replace(/\s+/g, " ")
    .trim();
}

// Check if two songs are essentially the same
function isDuplicateSong(title1, title2, threshold = 0.8) {
  if (!title1 || !title2) return false;
  
  const norm1 = normalizeSongTitle(title1);
  const norm2 = normalizeSongTitle(title2);
  
  // Empty after normalization
  if (!norm1 || !norm2) return false;
  
  // Exact match
  if (norm1 === norm2) return true;
  
  // One contains the other (for short titles)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return true;
  }
  
  const maxLen = Math.max(norm1.length, norm2.length);
  const dist = levenshtein(norm1, norm2);
  const similarity = 1 - dist / maxLen;
  
  return similarity >= threshold;
}

// Extract main artist
function getMainArtist(artist) {
  if (!artist) return "";
  return artist
    .toLowerCase()
    .split(/feat\.|ft\.|featuring|,|&|\||x /)[0]
    .trim();
}

// Get all artist variations for matching
function getArtistVariations(artist) {
  if (!artist) return new Set();
  const variations = new Set();
  
  // Add full artist string
  variations.add(artist.toLowerCase().trim());
  
  // Add main artist
  const main = getMainArtist(artist);
  if (main) variations.add(main);
  
  // Add all split artists
  const parts = artist.toLowerCase().split(/feat\.|ft\.|featuring|,|&|\||x /);
  parts.forEach(part => {
    const cleaned = part.trim();
    if (cleaned) variations.add(cleaned);
  });
  
  return variations;
}

// Check if artists are related
function areArtistsRelated(artist1, artist2) {
  const vars1 = getArtistVariations(artist1);
  const vars2 = getArtistVariations(artist2);
  
  // Check for any overlap
  for (const v1 of vars1) {
    for (const v2 of vars2) {
      if (v1 === v2) return true;
      
      // Check similarity
      const maxLen = Math.max(v1.length, v2.length);
      if (maxLen > 0) {
        const dist = levenshtein(v1, v2);
        const similarity = 1 - dist / maxLen;
        if (similarity >= 0.85) return true;
      }
    }
  }
  
  return false;
}

async function autoplay(player, client) {
  try {
    const track = player.getPrevious();
    if (!track) return;

    const TSource = track.sourceName;
    const playedTracks = player.data.get("playedTracks") || new Set();
    const recentQueue = player.data.get("recentQueue") || [];
    
    const originalTitle = track.title?.trim();
    const originalArtist = track.author?.trim();
    const normalizedOriginal = normalizeSongTitle(originalTitle);

    if (!originalTitle || !normalizedOriginal) return;

    // Add to recent queue (keep last 20 songs for duplicate checking)
    recentQueue.push({
      title: originalTitle,
      normalized: normalizedOriginal,
      artist: originalArtist,
    });
    if (recentQueue.length > 20) recentQueue.shift();
    player.data.set("recentQueue", recentQueue);

    let engine;
    let searchQueries = [];

    switch (TSource) {
      case "spotify":
        engine = "spsearch";
        searchQueries = [
          `${originalArtist}`, // Same artist
          `${originalArtist} popular`, // Popular by artist
        ];
        break;
      case "soundcloud":
        engine = "scsearch";
        searchQueries = [
          `${originalArtist}`,
          `${originalArtist} latest`,
        ];
        break;
      case "applemusic":
        engine = "amsearch";
        searchQueries = [
          `${originalArtist}`,
        ];
        break;
      case "deezer":
        engine = "dzsearch";
        searchQueries = [
          `${originalArtist}`,
        ];
        break;
      case "youtube":
        engine = "ytsearch";
        searchQueries = [
          `${originalArtist} songs`, // Get more songs by artist
          `${originalArtist} official`,
        ];
        break;
      case "youtube_music":
        engine = "ytmsearch";
        searchQueries = [
          `${originalArtist} songs`,
          `${originalArtist}`,
        ];
        break;
      default:
        return;
    }

    let nextTrack = null;
    let bestScore = 0;
    let attemptCount = 0;

    // Try multiple search queries
    for (const searchQuery of searchQueries) {
      if (nextTrack) break;
      attemptCount++;

      const res = await player.search(searchQuery, {
        requester: track.requester,
        engine,
      });

      if (!res || !res.tracks.length) continue;

      // Shuffle results to add variety
      const shuffled = res.tracks.sort(() => Math.random() - 0.5);

      for (const candidate of shuffled) {
        // Skip if already played
        if (playedTracks.has(candidate.identifier)) continue;

        const candidateNormalized = normalizeSongTitle(candidate.title);
        if (!candidateNormalized) continue;

        // Check against ALL recent queue items
        let isDuplicate = false;
        for (const recent of recentQueue) {
          if (isDuplicateSong(candidateNormalized, recent.normalized, 0.75)) {
            isDuplicate = true;
            break;
          }
        }

        if (isDuplicate) continue;

        // Calculate score
        let score = 0;

        // Artist relevance (most important)
        if (areArtistsRelated(originalArtist, candidate.author)) {
          score += 60;
        } else {
          // Penalize unrelated artists heavily
          score -= 30;
        }

        // Duration similarity
        if (track.duration && candidate.duration) {
          const durationDiff = Math.abs(track.duration - candidate.duration);
          const durationSimilarity = Math.max(0, 1 - durationDiff / 240000);
          score += durationSimilarity * 20;
        }

        // Source consistency
        if (candidate.sourceName === TSource) {
          score += 15;
        }

        // Prefer non-explicit if original is clean (and vice versa)
        const originalExplicit = /explicit|parental|nsfw/i.test(originalTitle);
        const candidateExplicit = /explicit|parental|nsfw/i.test(candidate.title);
        if (originalExplicit === candidateExplicit) {
          score += 5;
        }

        // Update best match
        if (score > bestScore) {
          bestScore = score;
          nextTrack = candidate;
        }

        // If we have a good match (score >= 60), use it
        if (score >= 60) {
          break;
        }
      }
    }

    // If no good match found with same artist, try a different approach
    if (!nextTrack || bestScore < 40) {
      console.warn(
        `No good match found (score: ${bestScore}), trying random from same artist`);

      // Try one more search with just artist name and skip more aggressively
      const lastRes = await player.search(originalArtist, {
        requester: track.requester,
        engine,
      });

      if (lastRes && lastRes.tracks.length) {
        const randomStart = Math.floor(Math.random() * Math.min(10, lastRes.tracks.length));
        
        for (let i = randomStart; i < lastRes.tracks.length; i++) {
          const candidate = lastRes.tracks[i];
          
          if (playedTracks.has(candidate.identifier)) continue;

          const candidateNormalized = normalizeSongTitle(candidate.title);
          if (!candidateNormalized) continue;

          let isDuplicate = false;
          for (const recent of recentQueue) {
            if (isDuplicateSong(candidateNormalized, recent.normalized, 0.7)) {
              isDuplicate = true;
              break;
            }
          }

          if (!isDuplicate && areArtistsRelated(originalArtist, candidate.author)) {
            nextTrack = candidate;
            bestScore = 50;
            break;
          }
        }
      }
    }

    if (!nextTrack) {
      console.error(`No suitable track found for autoplay`);
      if (playedTracks.size > 30) {
        const tracksArray = Array.from(playedTracks);
        player.data.set("playedTracks", new Set(tracksArray.slice(-20)));
      }
      return;
    }

    // Add to played
    playedTracks.add(nextTrack.identifier);
    player.data.set("playedTracks", playedTracks);

    // Memory management
    if (playedTracks.size > 50) {
      const tracksArray = Array.from(playedTracks);
      player.data.set("playedTracks", new Set(tracksArray.slice(-30)));
    }

    player.queue.add(nextTrack);
    
    if (!player.playing && !player.paused) {
      player.play();
    }

    console.error(
      `Autoplay: Added "${nextTrack.title}" by "${nextTrack.author}" (Score: ${bestScore.toFixed(1)}, Attempt: ${attemptCount})`);
  } catch (e) {
    console.error(`Autoplay encountered an error:`, e);
  }
}

module.exports = {
  autoplay,
};