export function WuHubLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span
        className="grid h-8 w-8 place-items-center rounded-xl text-[13px] font-black tracking-tighter"
        style={{
          background:
            "linear-gradient(135deg, var(--accent-hex, #00D8FF), color-mix(in oklab, var(--accent-hex, #00D8FF) 40%, #7c3aed))",
          color: "#001018",
          boxShadow: "0 8px 24px rgba(var(--accent-rgb, 0 216 255) / 0.4)",
        }}
        aria-hidden
      >
        W
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-foreground">
        cinehub<span style={{ color: "var(--accent-hex, #00D8FF)" }}>HD</span>
      </span>
    </span>
  );
}