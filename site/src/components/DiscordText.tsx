import { Fragment } from "react";

// Discord custom emoji syntax: <:name:id> or <a:name:id> (animated)
const EMOJI_RE = /<(a?):([A-Za-z0-9_~]+):(\d{17,20})>/g;

/** Removes Discord emoji markup, e.g. for search matching. */
export const stripDiscordEmoji = (text: string) => text.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();

/** Renders text from the bot, turning Discord custom emoji markup into inline images. */
const DiscordText = ({ text }: { text: string }) => {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    const [raw, animated, name, id] = m;
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(
      <img
        key={`${id}-${at}`}
        src={`https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=32`}
        alt={`:${name}:`}
        title={`:${name}:`}
        loading="lazy"
        className="inline-block w-[1.15em] h-[1.15em] align-[-0.2em] mx-0.5 object-contain"
      />
    );
    last = at + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
};

export default DiscordText;
