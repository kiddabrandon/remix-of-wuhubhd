export const IMG = "https://image.tmdb.org/t/p";

export function poster(path: string | null | undefined, size: "w92" | "w185" | "w342" | "w500" | "original" = "w500") {
  if (!path) return null;
  return `${IMG}/${size}${path}`;
}

export function backdrop(path: string | null | undefined, size: "w780" | "w1280" | "original" = "original") {
  if (!path) return null;
  return `${IMG}/${size}${path}`;
}

export type TmdbItem = {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
};

export function titleOf(x: TmdbItem) {
  return x.title || x.name || "Untitled";
}

export function yearOf(x: TmdbItem) {
  const d = x.release_date || x.first_air_date;
  return d ? d.slice(0, 4) : "";
}

export function mediaTypeOf(x: TmdbItem): "movie" | "tv" {
  if (x.media_type === "movie" || x.media_type === "tv") return x.media_type;
  return x.title ? "movie" : "tv";
}
