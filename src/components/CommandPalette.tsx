import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Search, X, Film, Tv, Sparkles } from "lucide-react";
import { tmdbSearchMulti } from "@/lib/tmdb.functions";
import { animeSearch, type AnimeItem } from "@/lib/anilist";
import { poster, titleOf, yearOf, mediaTypeOf, type TmdbItem } from "@/lib/tmdb-utils";

type Row =
  | { kind: "tmdb"; item: TmdbItem }
  | { kind: "anime"; item: AnimeItem };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setQ("");
      setDebounced("");
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  const tmdbQuery = useQuery({
    queryKey: ["search", "tmdb", debounced],
    queryFn: () => tmdbSearchMulti({ data: { query: debounced } }),
    enabled: !!debounced,
    staleTime: 60_000,
  });

  const animeQuery = useQuery({
    queryKey: ["search", "anime", debounced],
    queryFn: () => animeSearch(debounced),
    enabled: !!debounced,
    staleTime: 60_000,
  });

  const tmdbRows: Row[] = (tmdbQuery.data?.results ?? [])
    .filter((r: TmdbItem) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 8)
    .map((item) => ({ kind: "tmdb", item }));

  const animeRows: Row[] = (animeQuery.data ?? [])
    .slice(0, 6)
    .map((item) => ({ kind: "anime", item }));

  const rows: Row[] = [...tmdbRows, ...animeRows];
  const isFetching = tmdbQuery.isFetching || animeQuery.isFetching;

  useEffect(() => {
    setActive(0);
  }, [debounced]);

  const go = (row: Row) => {
    onClose();
    if (row.kind === "anime") {
      navigate({ to: "/anime/$id", params: { id: String(row.item.id) } });
    } else {
      navigate({
        to: "/watch/$type/$id",
        params: { type: mediaTypeOf(row.item), id: String(row.item.id) },
      });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (rows[active]) go(rows[active]);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 p-4 pt-[10vh] backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: -20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0c] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/5 px-4">
              <Search className="h-4 w-4 text-neutral-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search movies, TV, anime…"
                className="flex-1 bg-transparent py-4 text-base outline-none placeholder:text-neutral-500"
              />
              <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400 sm:inline">
                ESC
              </kbd>
              <button onClick={onClose} className="rounded p-1 text-neutral-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {!debounced && (
                <div className="p-8 text-center text-sm text-neutral-500">Start typing to search…</div>
              )}
              {debounced && isFetching && rows.length === 0 && (
                <div className="p-8 text-center text-sm text-neutral-500">Searching…</div>
              )}
              {debounced && !isFetching && rows.length === 0 && (
                <div className="p-8 text-center text-sm text-neutral-500">No results for "{debounced}"</div>
              )}
              <ResultsList rows={rows} active={active} setActive={setActive} onGo={go} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ResultsList({
  rows,
  active,
  setActive,
  onGo,
}: {
  rows: Row[];
  active: number;
  setActive: (i: number) => void;
  onGo: (r: Row) => void;
}) {
  const tmdbEnd = rows.findIndex((r) => r.kind === "anime");
  return (
    <ul>
      {rows.map((row, i) => {
        const showAnimeHeader = tmdbEnd >= 0 && i === tmdbEnd;
        return (
          <li key={`${row.kind}-${row.item.id}`}>
            {showAnimeHeader && (
              <div className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-widest text-neutral-500">
                Anime
              </div>
            )}
            {i === 0 && rows.some((r) => r.kind === "tmdb") && (
              <div className="px-3 pb-1 pt-1 text-[10px] uppercase tracking-widest text-neutral-500">
                Movies & TV
              </div>
            )}
            <ResultRow row={row} active={i === active} onEnter={() => setActive(i)} onClick={() => onGo(row)} />
          </li>
        );
      })}
    </ul>
  );
}

function ResultRow({
  row,
  active,
  onEnter,
  onClick,
}: {
  row: Row;
  active: boolean;
  onEnter: () => void;
  onClick: () => void;
}) {
  if (row.kind === "anime") {
    const it = row.item;
    return (
      <button
        onMouseEnter={onEnter}
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
          active ? "bg-white/5" : "hover:bg-white/5"
        }`}
      >
        <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-neutral-900">
          {it.poster && <img src={it.poster} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{it.title}</div>
          <div className="text-xs text-neutral-500">
            {[it.year, it.format].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-neutral-400">
          <Sparkles className="h-3 w-3" /> Anime
        </div>
      </button>
    );
  }
  const it = row.item;
  const type = mediaTypeOf(it);
  const src = poster(it.poster_path, "w92");
  return (
    <button
      onMouseEnter={onEnter}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
        active ? "bg-white/5" : "hover:bg-white/5"
      }`}
    >
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-neutral-900">
        {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{titleOf(it)}</div>
        <div className="text-xs text-neutral-500">{yearOf(it)}</div>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-neutral-400">
        {type === "movie" ? <Film className="h-3 w-3" /> : <Tv className="h-3 w-3" />}
        {type === "movie" ? "Movie" : "TV"}
      </div>
    </button>
  );
}
