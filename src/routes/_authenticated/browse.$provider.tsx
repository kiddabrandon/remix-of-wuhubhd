import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PosterCard } from "@/components/PosterCard";
import { tmdbDiscover } from "@/lib/tmdb.functions";
import { PROVIDERS } from "@/components/ProvidersRow";

export const Route = createFileRoute("/_authenticated/browse/$provider")({
  component: BrowseProvider,
});

function BrowseProvider() {
  const { provider } = Route.useParams();
  const meta = PROVIDERS.find((p) => p.id === provider);

  const movies = useQuery({
    queryKey: ["provider", "movie", provider],
    queryFn: () => tmdbDiscover({ data: { type: "movie", provider, sort: "popularity.desc" } }),
    staleTime: 5 * 60_000,
  });
  const tv = useQuery({
    queryKey: ["provider", "tv", provider],
    queryFn: () => tmdbDiscover({ data: { type: "tv", provider, sort: "popularity.desc" } }),
    staleTime: 5 * 60_000,
  });

  const movieItems = (movies.data?.results ?? []).map((r: any) => ({ ...r, media_type: "movie" }));
  const tvItems = (tv.data?.results ?? []).map((r: any) => ({ ...r, media_type: "tv" }));

  return (
    <div className="space-y-10 px-4 py-10 sm:px-8">
      <header className="flex items-center gap-4">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl text-xl font-bold"
          style={{
            background: `${meta?.color ?? "#fff"}22`,
            color: meta?.color ?? "#fff",
            border: `1px solid ${meta?.color ?? "#fff"}55`,
          }}
        >
          {(meta?.name ?? "?")[0]}
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {meta?.name ?? "Provider"}
          </h1>
          <p className="text-sm text-neutral-400">Popular titles available on {meta?.name ?? "this service"}.</p>
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Movies</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {movieItems.map((it: any) => (
            <PosterCard key={`m-${it.id}`} item={it} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">TV Shows</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {tvItems.map((it: any) => (
            <PosterCard key={`t-${it.id}`} item={it} />
          ))}
        </div>
      </section>
    </div>
  );
}
