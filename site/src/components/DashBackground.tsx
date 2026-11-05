// Fixed page backdrop matching the RankCore dashboard: faint grid + soft red / cool glows.
const DashBackground = () => (
  <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
    <div
      className="absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
        maskImage: "radial-gradient(ellipse at 30% 0%, black 20%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at 30% 0%, black 20%, transparent 75%)",
      }}
    />
    <div className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full bg-noxx-red/[0.09] blur-[140px]" />
    <div className="absolute -bottom-48 -right-40 w-[520px] h-[520px] rounded-full bg-[#1e2a5a]/25 blur-[150px]" />
  </div>
);

export default DashBackground;
