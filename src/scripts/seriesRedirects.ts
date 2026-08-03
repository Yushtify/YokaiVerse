/**
 * Redirects to the INFO page of a series.
 * Strips any season/episode info to show the main series page.
 * Usage: findAnimeInfo("oshiNoKo+s1_ep5") -> /info/anime?v=oshiNoKo
 */
function findAnimeInfo(videoID: string): void {
  if (!videoID) return;

  // Extract only the base ID, remove any season/episode info (like +s1_ep1)
  const baseID = videoID.split(/[+ ]/)[0];

  console.log("[Navigation]: Redirecting to Info -> " + baseID);
  window.location.href = "/info/anime?v=" + baseID;
}
(window as any).findAnimeInfo = findAnimeInfo;

/**
 * Redirects to the WATCH page with specific Season and Episode.
 * Usage: findAnime("oshiNoKo", 1, 5) -> /watch?v=oshiNoKo+s1_ep5
 */
function findAnime(animeID: string, season?: number, episode?: number): void {
  if (!animeID) return;

  // Extract only the base ID if it already contains "+s" etc.
  const baseID = animeID.split(/[+ ]/)[0];

  // If season and episode are provided as parameters, use them.
  // If not provided and animeID already contains them (old format), keep them.
  let target = baseID;

  if (season !== undefined && episode !== undefined) {
    target = `${baseID}+s${season}_ep${episode}`;
  } else if (animeID.includes("+")) {
    target = animeID; // Already formatted, don't modify
  } else {
    target = `${baseID}+v1_ch1`; // Default if nothing provided
  }

  console.log("[Navigation]: Redirecting to Watch -> " + target);
  window.location.href = "/watch?v=" + target;
}
(window as any).findAnime = findAnime;

/**
 * Redirects to the INFO page of a series.
 * Strips any season/episode info to show the main series page.
 * Usage: findMangaInfo("oshiNoKo+v1_ch5") -> /info/anime?v=oshiNoKo
 */
function findMangaInfo(videoID: string): void {
  if (!videoID) return;

  // Extract only the base ID, remove any season/episode info (like +s1_ep1)
  const baseID = videoID.split(/[+ ]/)[0];

  console.log("[Navigation]: Redirecting to Info -> " + baseID);
  window.location.href = "/info/manga?v=" + baseID;
}
(window as any).findMangaInfo = findMangaInfo;

/**
 * Redirects to the WATCH page with specific Volume and Chapter.
 * Usage: findManga("oshiNoKo", 1, 5) -> /watch?v=oshiNoKo+v1_ch5
 */
function findManga(animeID: string, volume?: number, chapter?: number): void {
  if (!animeID) return;

  // Extract only the base ID if it already contains "+s" etc.
  const baseID = animeID.split(/[+ ]/)[0];

  // If volume and chapter are provided as parameters, use them.
  // If not provided and animeID already contains them (old format), keep them.
  let target = baseID;

  if (volume !== undefined && chapter !== undefined) {
    target = `${baseID}+v${volume}_ch${chapter}`;
  } else if (animeID.includes("+")) {
    target = animeID; // Already formatted, don't modify
  } else {
    target = `${baseID}+v1_ch1`; // Default if nothing provided
  }

  console.log("[Navigation]: Redirecting to Watch -> " + target);
  window.location.href = "/read?v=" + target;
}
(window as any).findManga = findManga;
