import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Character } from "../lib/characters";

type Props = {
  character: Character;
  /**
   * Visual size — controls dimensions only. Pass `className` for custom sizing.
   * - `sm` = 40×40 (small chip)
   * - `md` = 44×44 (compact card header)
   * - `lg` = aspect-square fills container (large grid tile)
   */
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
};

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-10 w-10 text-sm",
  md: "h-11 w-11 text-sm",
  lg: "aspect-square w-full text-base",
};

/**
 * Renders a character's portrait. Falls back to a colored gradient with the
 * character's initials if the icon is missing or fails to load — keeps the
 * roster usable even before `pnpm assets:avatars` has run.
 *
 * Card background: always the character's color gradient. Avatar PNGs are
 * chroma-keyed transparent (see `pnpm assets:trim-avatars`), so the colored
 * card shows through the silhouette and the character pops on their own
 * theme. Initials fallback uses the same gradient for consistency.
 */
export default function CharacterAvatar({
  character,
  size = "md",
  className,
  style,
}: Props) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(character.icon) && !errored;

  useEffect(() => {
    setErrored(false);
  }, [character.icon]);

  return (
    <div
      className={[
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md font-bold text-stone-950",
        SIZE_CLASS[size],
        className ?? "",
      ].join(" ")}
      style={{
        background: `linear-gradient(180deg, ${character.color}, color-mix(in srgb, ${character.color} 62%, #0c0a09))`,
        boxShadow: `inset 0 0 0 1.5px ${character.color}aa`,
        ...style,
      }}
    >
      {showImage ? (
        <img
          src={character.icon}
          alt={character.name}
          className="h-full w-full object-contain"
          style={{ imageRendering: "pixelated" }}
          onError={() => setErrored(true)}
          draggable={false}
        />
      ) : (
        <span>{character.name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
