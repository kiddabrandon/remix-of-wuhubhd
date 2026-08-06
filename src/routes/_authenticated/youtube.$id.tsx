import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Youtube as YoutubeIcon } from "lucide-react";
import { searchYoutube, youtubeVideoDetails } from "@/lib/youtube.functions";
import { useApp } from "@/lib/app-store";

export const Route = createFileRoute("/_authenticated/youtube/$id")({
  head: () => ({
    meta: [
      { title: "Watch on YouTube — WuHubHD" },
      { name: "description", content: "Play a YouTube video inside WuHubHD with related results." },
      { property: "og:title", content: "Watch on YouTube — WuHubHD" },
      { property: "og:description", content: "Full-screen YouTube playback with related videos, inside WuHubHD." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: YoutubeWatch;
});

function YoutubeWatch() {
  return null;
}
