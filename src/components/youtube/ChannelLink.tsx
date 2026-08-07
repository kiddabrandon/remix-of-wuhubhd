import { Link } from "@tanstack/react-router";

export function ChannelLink({
  channelId,
  name,
  className = "",
}: {
  channelId: string | null;
  name: string;
  className?: string;
}) {
  if (!channelId) return <span className={className}>{name}</span>;
  return (
    <Link
      to="/youtube/channel/$channelId"
      params={{ channelId }}
      className={`hover:underline hover:text-white ${className}`}
    >
      {name}
    </Link>
  );
}
