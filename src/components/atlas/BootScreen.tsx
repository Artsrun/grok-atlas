export function BootScreen({
  label = "Acquiring earth textures",
  detail,
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-wafer px-6 text-center text-silk">
      <div className="font-display text-sm font-bold tracking-[0.28em] text-silk">
        GROK<span className="text-ochre">.ATLAS</span>
      </div>
      <div className="font-mono text-micro uppercase tracking-[0.28em] text-dim">{label}</div>
      <div className="h-px w-48 overflow-hidden bg-etch">
        <i className="block h-full w-1/2 animate-pulse bg-ochre" />
      </div>
      {detail ? (
        <p className="max-w-xs font-mono text-2xs leading-relaxed tracking-wide text-dimmer">
          {detail}
        </p>
      ) : (
        <p className="max-w-xs font-mono text-2xs leading-relaxed tracking-wide text-dimmer">
          City lights · airglow limb · ISS cupola · v2.0
        </p>
      )}
    </div>
  );
}
