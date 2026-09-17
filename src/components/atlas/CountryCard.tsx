import {
  formatArea,
  formatPop,
  factLine,
  formatTld,
  formatPhones,
  flagSrc,
  type CountryFact,
} from "@/lib/atlas/facts";
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

function Vital({ fact }: { fact: CountryFact }) {
  const bits: string[] = [];
  if (fact.iso2) bits.push(fact.iso2);
  else if (fact.iso) bits.push(fact.iso);
  const tld = formatTld(fact.tld);
  if (tld) bits.push(tld);
  const tel = formatPhones(fact.phones);
  if (tel) bits.push(tel);
  if (fact.currency) bits.push(fact.currency);
  if (!bits.length) return null;
  return (
    <p className="mt-0.5 font-mono text-2xs uppercase tracking-[0.14em] text-dimmer">
      {bits.join(" · ")}
    </p>
  );
}

/**
 * What a country is, once you have tapped it: flag + country name (the thing
 * you clicked), then TLD / phone / currency, then the capital as a destination.
 */
export function CountryCard({ name }: { name: string }) {
  const fact = useAtlas((s) => s.facts[name]);
  const story = storyFor(fact?.iso);
  const measured = factLine(fact);
  const src = flagSrc(fact?.iso2);

  return (
    <div>
      <div className="flex items-start gap-2 pr-8">
        {src ? (
          <img
            src={src}
            alt=""
            width={24}
            height={16}
            className="mt-0.5 h-4 w-6 shrink-0 border border-etch object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : fact?.flag ? (
          <span aria-hidden className="mt-0.5 text-sm leading-none">
            {fact.flag}
          </span>
        ) : null}
        <div className="min-w-0">
          <span className="block font-display text-sm leading-tight tracking-wide text-silk">{name}</span>
          {fact ? <Vital fact={fact} /> : null}
        </div>
      </div>

      {fact?.capital ? (
        <button
          type="button"
          onClick={() =>
            fact.lat != null &&
            fact.lon != null &&
            useAtlas.getState().flyTo({ lat: fact.lat, lon: fact.lon, label: name, dist: 1.9 })
          }
          aria-label={`Fly to ${fact.capital}, capital of ${name}`}
          className="press mt-1.5 flex min-h-8 items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em]"
        >
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-white" />
          <span className="text-dim">{fact.capital}</span>
          {fact.capitalPop ? <span className="text-dimmer">{formatPop(fact.capitalPop)}</span> : null}
          <span className="text-dimmer">↗</span>
        </button>
      ) : null}

      {story ? (
        <p className="mt-1.5 max-w-prose font-sans text-xs leading-relaxed text-dim">{story}</p>
      ) : measured ? (
        <p className="mt-1.5 font-mono text-2xs uppercase tracking-[0.14em] text-dim">{measured}</p>
      ) : null}

      {fact ? <Attributes fact={fact} /> : null}
    </div>
  );
}
