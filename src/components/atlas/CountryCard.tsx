import { formatArea, formatPop, factLine, type CountryFact } from "@/lib/atlas/facts";
import { storyFor } from "@/lib/atlas/stories";
import { useAtlas } from "@/lib/atlas/store";

/** Region, size, and how many neighbours — the attributes, in one row. */
function Attributes({ fact }: { fact: CountryFact }) {
  const bits: string[] = [];
  if (fact.subregion) bits.push(fact.subregion);
  if (fact.area) bits.push(formatArea(fact.area));
  if (fact.landlocked) bits.push("landlocked");
  else if (fact.neighbours === 0) bits.push("island");
  else if (fact.neighbours) bits.push(`${fact.neighbours} neighbours`);
  if (!bits.length) return null;
  return (
    <p className="mt-1 font-mono text-2xs uppercase tracking-[0.14em] text-dimmer">
      {bits.join(" · ")}
    </p>
  );
}

/**
 * What a country is, once you have tapped it: its name, its capital in white,
 * and one true line about that capital. Countries without a written story keep
 * the measured line rather than borrowing someone else's prose.
 */
export function CountryCard({ name }: { name: string }) {
  const fact = useAtlas((s) => s.facts[name]);
  const story = storyFor(fact?.iso);
  const measured = factLine(fact);

  return (
    <div>
      {/* The close control owns the top-right corner, so nothing else may
          live there — the population sits with the capital it counts. */}
      <div className="pr-8">
        <span className="font-display text-lg leading-tight tracking-wide text-silk">{name}</span>
      </div>

      {fact?.capital ? (
        <button
          type="button"
          // The capital is a place on this globe, so it is somewhere you can
          // go. White, and marked — the one thing here that is neither gold
          // nor dim.
          onClick={() =>
            fact.lat != null &&
            fact.lon != null &&
            useAtlas.getState().flyTo({ lat: fact.lat, lon: fact.lon, label: name, dist: 1.9 })
          }
          aria-label={`Fly to ${fact.capital}, capital of ${name}`}
          className="press mt-1 flex min-h-9 items-center gap-2 font-mono text-xs uppercase tracking-[0.18em]"
        >
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-white" />
          <span className="font-semibold text-white">{fact.capital}</span>
          {fact.capitalPop ? (
            <span className="text-dimmer">{formatPop(fact.capitalPop)}</span>
          ) : null}
          <span className="text-dimmer">↗</span>
        </button>
      ) : null}

      {story ? (
        <p className="mt-2 max-w-prose font-sans text-xs leading-relaxed text-dim">{story}</p>
      ) : measured ? (
        <p className="mt-2 font-mono text-2xs uppercase tracking-[0.14em] text-dim">{measured}</p>
      ) : null}

      {fact ? <Attributes fact={fact} /> : null}
    </div>
  );
}
