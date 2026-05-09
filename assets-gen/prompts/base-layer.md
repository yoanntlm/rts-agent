# Base-layer tile prompts — Singapore tropical city builder

Canonical prompts for the floor / ground layer of the world. These are the tiles
the editor paints under everything else: park grass, sidewalks, roads, water,
hawker floor. **No buildings, no props, no characters here** — those live in
their own catalog (`buildings.md`, etc., when we add them).

Each prompt is self-contained — paste directly into `/playground` and click
Generate.

## Recommended workflow

1. **Anchor first.** Generate `parkGrass` until you're happy with the palette,
   saturation, and pixel grain. Save the winner.
2. **Style-anchor everything else.** For every subsequent tile, click `+ ref`
   on your winning park-grass entry in the library. The model will use it via
   `images.edit` to keep palette and grain consistent across the set.
3. **Promote when satisfied.** Use `→ tile` to copy a saved PNG into the right
   slot in `client/public/assets/generated/`.

## Recommended params (default for everything below)

- **Model:** `gpt-image-2`
- **Size:** `1024x1024`
- **Quality:** `high`
- **Background:** `opaque` (these are floor tiles)
- **N:** `2` — pick the calmer of the two, costs the same as one re-roll

If a prompt overrides any of these, it's noted at the top of that section.

---

## Park & nature

### `parkGrass` — base park grass

Filename: `park-grass.png` · Anchor tile, no refs.

```
Top-down 1024x1024 pixel-art tile of MANICURED PARK GRASS in modern
tropical Singapore — the kind of short, healthy, well-tended turf
underfoot in HDB void-deck parks or on the Padang lawn.

Style: Stardew Valley pixel-art technique — hand-painted feel, gentle
dithering, visible pixel grain but not chunky, no harsh outlines.

Palette: bright tropical greens — deep #2c5b1e, mid #58a13a, highlight
#9bd25c. Even, slightly warm midday light, NOT evening or golden hour.

Perspective: strict top-down, 90° from directly above. The tile is flat
ground seen from a bird's-eye view. No parallax, no foreshortening.

Composition: a uniform, calm patch of grass filling the entire square,
edge to edge. Subtle organic variation — a few slightly-lighter tufts
and a few slightly-darker patches — but no flowers, no clover, no
creatures, no rocks, no path, no shadows from off-tile objects. This is
the BASE tile that will fill ~70% of the map, so it must read quiet.

Output rules: single square tile filling the full frame, designed to
TILE seamlessly when placed beside copies of itself — no half-cut
features at the edges, no border, no frame, no drop shadow, no
signature, no grid lines, no text.

EXPLICITLY AVOID: forest moss, dungeon textures, JRPG fantasy meadow,
cartoon Pokemon overworld, photorealistic grass, lawn-care marketing
imagery, flowers of any kind.
```

### `parkGrassOrchid` — grass with orchid scatter

Filename: `park-grass-orchid.png` · Ref: `parkGrass`.

```
Top-down 1024x1024 pixel-art tile of MANICURED PARK GRASS WITH ORCHID
SPRIGS in modern tropical Singapore. Grass identical to the base park
grass tile (use reference image), with three or four tiny pale-purple
Vanda Miss Joaquim orchid sprigs (Singapore's national flower) scattered
asymmetrically across the tile.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain.

Palette: same tropical greens as base grass (deep #2c5b1e, mid #58a13a,
highlight #9bd25c) plus pale lavender-purple orchid blooms #c8a8e0 with
slightly darker centers and small green stems.

Perspective: strict top-down, 90° from directly above.

Composition: each orchid sprig is small — about 1/15th of the tile,
roughly the size of a fingernail at scale — placed asymmetrically and
WELL CLEAR of the tile edges (no half-orchids on the borders). Spread
them out so the tile reads like a 15% scatter variant: orchids visible
but not dominating. The underlying grass texture should match the base
grass tile exactly.

Output rules: single square tile, full frame, tiles seamlessly with
copies of itself and with the base grass, no border, no signature, no
grid lines, no text.

EXPLICITLY AVOID: orchids touching or crossing edges, dense bouquets,
clusters, large blooms, bright unnatural purple, other flower species,
creatures, rocks, paths.
```

### `parkGrassHibiscus` — grass with hibiscus + ferns

Filename: `park-grass-hibiscus.png` · Ref: `parkGrass`.

```
Top-down 1024x1024 pixel-art tile of MANICURED PARK GRASS WITH HIBISCUS
in modern tropical Singapore. Grass identical to the base park grass
tile (use reference image), with two small hibiscus blooms — one red,
one yellow — and three or four short fern fronds scattered
asymmetrically inside the tile body.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain.

Palette: same tropical greens as base grass (deep #2c5b1e, mid #58a13a,
highlight #9bd25c) plus warm hibiscus red #c84a3a, sunny hibiscus
yellow #e8c84a, and slightly darker fern green #2c5b1e.

Perspective: strict top-down, 90° from directly above.

Composition: each hibiscus bloom is small (~1/12th of the tile), the
two blooms placed asymmetrically and well clear of the edges. The
ferns are short fronds, also small and inside the tile body. The
underlying grass matches the base grass exactly.

Output rules: single square tile, full frame, tiles seamlessly, no
border, no signature, no grid lines, no text.

EXPLICITLY AVOID: large blooms, flowers cut by edges, dense bouquets,
photorealistic petals, creatures, paths, rocks, other species of
flower.
```

### `parkGrassRooster` — grass with red junglefowl

Filename: `park-grass-rooster.png` · Ref: `parkGrass`. Rare delight tile (~1%).

```
Top-down 1024x1024 pixel-art tile of MANICURED PARK GRASS WITH A WILD
RED JUNGLEFOWL ROOSTER in modern tropical Singapore. The kind of feral
rooster that genuinely roams Bishan and Sin Ming HDB neighborhoods.
Grass identical to the base park grass tile (use reference image).

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain.

Palette: same tropical greens as base grass (deep #2c5b1e, mid #58a13a,
highlight #9bd25c) plus rooster colors — vivid red comb #c83a3a, dark
charcoal body feathers #2a2018, orange-tan flight feathers #c8763a,
small black beak.

Perspective: strict top-down, 90° from directly above. The bird is
seen from above, so its body is an oblong shape with red comb visible
on the head, dark wings folded, tail feathers fanning back.

Composition: ONE rooster, placed center-left of the tile, walking — a
small dot of personality on an otherwise calm grass field. Bird is
small but legible (~1/8th of the tile). The rooster sits well clear
of the tile edges. Grass underneath matches base grass exactly.

Output rules: single square tile, full frame, tile seamlessly with
copies of itself and with base grass, no border, no signature, no
text.

EXPLICITLY AVOID: large rooster filling the tile, multiple birds,
chicken-coop styling, cartoonish big-eyed rooster, profile/side view
(this is top-down), shadows, flowers, paths.
```

### `parkGrassMynah` — grass with common mynah bird

Filename: `park-grass-mynah.png` · Ref: `parkGrass`. Rare delight tile (~1%).

```
Top-down 1024x1024 pixel-art tile of MANICURED PARK GRASS WITH A
COMMON MYNAH BIRD in modern tropical Singapore — the most ubiquitous
urban bird in the country. Grass identical to the base park grass tile
(use reference image).

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain.

Palette: same tropical greens as base grass (deep #2c5b1e, mid #58a13a,
highlight #9bd25c) plus mynah colors — dark warm brown body #4a2e1a,
yellow-orange eye-mask and bill #d8a838, white wing-tip patches #e8e0d0.

Perspective: strict top-down, 90° from directly above. The bird is
seen from above — body is a small oblong with the head visible, the
yellow eye-patch peeking around it, white tips on the folded wings.

Composition: ONE mynah bird, mid-tile, perched or hopping. Small
(~1/8th of the tile) and well inside the tile body. The grass
underneath matches base grass exactly.

Output rules: single square tile, full frame, tile seamlessly, no
border, no signature, no text.

EXPLICITLY AVOID: large mynah filling the tile, multiple birds, side
profile, cartoonish styling, shadows, flowers, paths.
```

### `parkGrassMango` — grass with fallen mango

Filename: `park-grass-mango.png` · Ref: `parkGrass`. Rare delight tile (~1%).

```
Top-down 1024x1024 pixel-art tile of MANICURED PARK GRASS WITH A
FALLEN RIPE MANGO in modern tropical Singapore — the kind that drops
from the mango trees lining HDB estates. Grass identical to the base
park grass tile (use reference image).

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain.

Palette: same tropical greens as base grass (deep #2c5b1e, mid #58a13a,
highlight #9bd25c) plus mango colors — golden-yellow #e8b840, sunset
orange flush #d87830, leaf green #3a6f28.

Perspective: strict top-down, 90° from directly above.

Composition: ONE ripe mango (kidney-shape, sunset-orange flush over
gold) lying mid-tile, with two or three loose green mango leaves
scattered around it. Mango is small (~1/10th of the tile) and well
inside the tile body. Grass matches base grass exactly.

Output rules: single square tile, full frame, tile seamlessly, no
border, no signature, no text.

EXPLICITLY AVOID: tree branches, multiple mangos, sliced/cut mango,
cartoon mango with face, shadows of off-tile objects.
```

### `tropicalFoliage` — dense planted foliage

Filename: `tropical-foliage.png` · Ref: `parkGrass` (for palette anchor only).

```
Top-down 1024x1024 pixel-art tile of DENSELY PLANTED TROPICAL FOLIAGE
in modern tropical Singapore — the lush border vegetation seen at the
edges of MacRitchie Reservoir, Bukit Timah, or East Coast Park. NO
exposed grass underneath, this is solid bushes and ferns.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain, depth from layered shadows.

Palette: a stack of greens — shadow #1a3a14, mid #3a6f28, mid-bright
#58a13a, highlight #9bd25c — plus a few warm-brown stems #5a3a22.

Perspective: strict top-down, 90° from directly above. Plants seen
from above as overlapping leaf clusters of varying shape and size.

Composition: the entire tile is a dense overlapping mat of broad palm
fronds, monstera leaves, fern clusters, and small bushes. Multiple
shades of green stacked to imply depth. Deep shadows under the leaves
where they overlap. No exposed soil, no grass, no flowers, no
creatures.

Output rules: single square tile, full frame, tiles seamlessly with
copies of itself, no border, no signature, no text.

EXPLICITLY AVOID: a single big leaf centered (the tile must read as a
patch of mixed plants), flowers, photoreal foliage, jungle vines, tree
trunks, dirt patches between plants.
```

### `lalangGrass` — tall wild grass

Filename: `lalang-grass.png` · Ref: `parkGrass` (for palette).

```
Top-down 1024x1024 pixel-art tile of TALL WILD LALANG (cogon) GRASS in
modern tropical Singapore — the tall grass on undeveloped lots before
construction begins. Untamed, slightly yellow-tipped, with feathery
flowering plumes.

Style: Stardew Valley pixel-art technique, hand-painted, visible
brush-stroke direction implying wind-sway.

Palette: yellow-green base #8aa850, mid-green #5a7a30, deep green
shadow #2c5b1e, cream-tan plume tips #d8c898.

Perspective: strict top-down, 90° from directly above. The grass is
tall enough that you see the seed plumes from above.

Composition: a tile uniformly covered in tall wild grass blades, with
a few feathery flowering plumes scattered through. Brush direction
implies a slight wind-sway. Calm, slightly untidy — this contrasts
with the manicured park grass.

Output rules: single square tile, full frame, tiles seamlessly, no
border, no signature, no text.

EXPLICITLY AVOID: short grass (this should clearly read as TALL grass
even from above), flowers, paths, creatures, manicured lawn,
golf-course-style trim.
```

---

## Walkways

### `paverBeige` — concrete interlocking paver

Filename: `paver-beige.png` · Ref: `parkGrass` (palette anchor across set).

```
Top-down 1024x1024 pixel-art tile of WARM-BEIGE INTERLOCKING CONCRETE
PAVERS in modern tropical Singapore — the I-shaped Holland-bond
pattern seen on Orchard Road sidewalks and HDB walkways. Default
sidewalk tile.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain.

Palette: warm beige base #c8b89a, paver shadow #8a7c64, paver
highlight #e8dcc1, dark grout line #6a5e4a.

Perspective: strict top-down, 90° from directly above.

Composition: rectangular I-shaped pavers laid in interlocking
Holland-bond pattern, each paver about 1/5 to 1/6 of the tile wide.
Subtle darker grout lines between pavers. Slight wear and tonal
variation paver-to-paver to feel walked-on. Designed to TILE
seamlessly horizontally and vertically as a long sidewalk.

Output rules: single square tile, full frame, tiles seamlessly, no
border, no signature, no text.

EXPLICITLY AVOID: medieval cobblestone, mossy stones, irregular field
stones, gravel, brick (a separate tile), photorealistic concrete,
weeds growing in the cracks, road markings.
```

### `paverRedBrick` — herringbone red brick

Filename: `paver-red-brick.png` · Ref: `parkGrass`.

```
Top-down 1024x1024 pixel-art tile of RED-CLAY BRICK PAVERS in
herringbone pattern — modern tropical Singapore, the kind of brick
floor seen at Tiong Bahru shophouse five-foot-ways and Chinatown
alleys.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain.

Palette: warm terracotta brick #b04a2a, brick shadow #6f2a16, brick
highlight #d97a52, narrow dark grout line #4a1a08.

Perspective: strict top-down, 90° from directly above.

Composition: rectangular bricks laid in herringbone pattern (each
brick at 90° to its neighbor), staggered, NOT aligned in a grid. Each
brick about 1/8 to 1/10 of the tile. Narrow darker grout. Subtle wear
and tonal variation brick-to-brick. Designed to tile seamlessly.

Output rules: single square tile, full frame, tiles seamlessly, no
border, no signature, no text.

EXPLICITLY AVOID: aligned brick grid (use herringbone), modern
glazed-brick, painted bricks, mossy bricks, weeds, road markings.
```

### `voidDeckTile` — HDB terrazzo

Filename: `void-deck-tile.png` · Ref: `parkGrass` (palette anchor).

```
Top-down 1024x1024 pixel-art tile of HDB VOID-DECK FLOOR — the iconic
ground-floor common-area floor in Singapore public housing. A 4x4 grid
of square red-and-cream terrazzo tiles, alternating but slightly
irregular.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain.

Palette: cream terrazzo #e0c8a8, warm-red terrazzo #b04a2a, subtle
flecking on each tile (small darker speckles), thin grey grout
#5a5048.

Perspective: strict top-down, 90° from directly above.

Composition: 4x4 grid of square tiles. Pattern is mostly checker-like
(red-cream-red-cream) but not perfectly regular — a few tiles in the
"wrong" color to feel hand-laid. Each tile shows subtle terrazzo
flecks (small darker speckles in a smoother base). Slightly worn,
smooth, lived-in.

Output rules: single square tile, full frame, tiles seamlessly with
copies of itself, no border, no signature, no text.

EXPLICITLY AVOID: bathroom-tile look, modern porcelain gloss, cracked
tiles, photorealistic, dirty/stained tiles, hexagonal or non-square
shapes.
```

---

## Streets

### `roadAsphalt` — plain asphalt

Filename: `road-asphalt.png` · No ref needed.

```
Top-down 1024x1024 pixel-art tile of PLAIN ASPHALT ROAD SURFACE — no
markings, no curbs, just road. Modern tropical Singapore, suitable to
fill under intersections and unmarked road stretches.

Style: Stardew Valley pixel-art technique, hand-painted, fine
aggregate texture suggested with subtle pixel speckling.

Palette: warm dark grey base #4a4a44, slightly lighter highlight
speckles #6e6e66, slightly darker shadow speckles #2a2a26.

Perspective: strict top-down, 90° from directly above.

Composition: uniform asphalt surface filling the entire tile, edge to
edge. Subtle organic variation in the speckling — feels textured but
calm. NO road markings of any kind, NO curbs, NO debris.

Output rules: single square tile, full frame, tiles seamlessly, no
border, no signature, no text, NO road markings.

EXPLICITLY AVOID: road markings (white/yellow lines, arrows, text),
tire skid marks, potholes, debris, curbs, sidewalks, photorealistic
asphalt, glistening wet asphalt.
```

### `roadCenterLine` — asphalt with dashed center stripes

Filename: `road-center-line.png` · Ref: `roadAsphalt`.

```
Top-down 1024x1024 pixel-art tile of A TWO-LANE ASPHALT ROAD WITH
DASHED WHITE CENTER STRIPES, modern tropical Singapore. Use the plain
asphalt tile as reference for surface texture.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering on the asphalt, sharp clean edges on the white markings.

Palette: same warm dark grey asphalt base as the plain asphalt tile,
plus painted-white #f5f0d8 center markings (slightly off-pure-white,
slightly worn).

Perspective: strict top-down, 90° from directly above.

Composition: TWO short white dashed lane stripes running HORIZONTALLY
across the tile (left edge to right edge), positioned at vertical
center, the markings of a two-lane road. Each dash is short, with a
small gap between dashes. Designed to TILE HORIZONTALLY to form a
continuous road of any length. The asphalt base matches the plain
asphalt tile.

Output rules: single square tile, full frame, tiles seamlessly with
copies of itself horizontally, no border, no signature, no extra text
on the road.

EXPLICITLY AVOID: solid double-yellow lines (this is dashed white),
zebra crossings, arrows, "STOP" or "BUS LANE" text, curbs, sidewalks
inside the tile.
```

### `roadZebra` — zebra crossing

Filename: `road-zebra.png` · Ref: `roadAsphalt`.

```
Top-down 1024x1024 pixel-art tile of A ZEBRA PEDESTRIAN CROSSING on
asphalt — the unmistakable Singapore zebra crossing seen outside MRT
stations and at uncontrolled junctions. Use the plain asphalt tile as
reference for surface texture.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering on the asphalt, sharp clean edges on the white stripes.

Palette: same warm dark grey asphalt base, plus painted-white #f5f0d8
zebra stripes (slightly worn at the edges).

Perspective: strict top-down, 90° from directly above.

Composition: FIVE wide white zebra stripes running VERTICALLY across
the tile (top edge to bottom edge), evenly spaced, perpendicular to
traffic. Each stripe is wide and clearly readable. The asphalt
between and around stripes matches the plain asphalt tile. Designed
to TILE HORIZONTALLY as a continuous crossing.

Output rules: single square tile, full frame, tiles seamlessly
horizontally, no border, no signature, no extra text.

EXPLICITLY AVOID: dashed lines, arrows, fewer than 4 stripes,
diagonal stripes, road text, curbs.
```

### `roadBusLane` — terracotta-painted bus lane

Filename: `road-bus-lane.png` · Ref: `roadAsphalt`.

```
Top-down 1024x1024 pixel-art tile of AN ASPHALT BUS LANE PAINTED THE
ICONIC SINGAPORE TERRACOTTA RED with a single white forward arrow.
Use the plain asphalt tile as reference for surface roughness.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, slightly faded paint feel.

Palette: terracotta-red bus-lane paint #b04a2a (faded, slightly
patchy), white forward arrow #f5f0d8, the asphalt base only barely
peeking through the paint.

Perspective: strict top-down, 90° from directly above.

Composition: the WHOLE tile painted terracotta red, slightly faded
and patchy where the asphalt shows through (worn paint feel). One
white forward-pointing arrow centered horizontally in the tile,
pointing UP. No "BUS LANE" text. Designed to tile vertically.

Output rules: single square tile, full frame, tiles seamlessly
vertically, no border, no signature, no text other than the arrow.

EXPLICITLY AVOID: "BUS LANE" or any text, multiple arrows,
backwards-pointing arrow, dashed lane lines, sidewalks, curbs,
unfaded factory-fresh paint.
```

---

## Civic floor

### `hawkerTile` — hawker centre ceramic floor

Filename: `hawker-tile.png` · Ref: `parkGrass` (palette anchor across set).

```
Top-down 1024x1024 pixel-art tile of A HAWKER-CENTRE CERAMIC FLOOR —
the warm, lived-in floor of Maxwell, Chinatown Complex, or Old Airport
Road food centres. A 4x4 grid of square cream tiles with terracotta
grout lines.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain.

Palette: cream tile body #f0e8d6, slight tile shadow #d8c8a8, warm
terracotta grout #c25a36, occasional faint stain spot #b89a76.

Perspective: strict top-down, 90° from directly above.

Composition: a 4x4 grid of square cream-colored ceramic tiles
separated by terracotta-colored grout lines. Slight stains and tonal
variation tile-to-tile to feel walked-on and food-service-warm. Each
tile in the grid is uniform, the variation comes from the wear.

Output rules: single square tile, full frame, tiles seamlessly with
copies of itself, no border, no signature, no text.

EXPLICITLY AVOID: bathroom-tile look, modern white tiles, hexagonal
shapes, photorealistic gloss, completely uniform pristine tiles,
chairs/tables visible (this is just floor).
```

### `kopitiamTile` — old kopitiam floor

Filename: `kopitiam-tile.png` · Ref: `parkGrass`.

```
Top-down 1024x1024 pixel-art tile of AN OLD SINGAPORE COFFEESHOP
(kopitiam) FLOOR — the geometric pattern floor of a heritage Tiong
Bahru kopitiam, with pale-green and cream square tiles in a 1980s
diamond-and-square motif.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, slightly nostalgic worn feel.

Palette: pale mint-green tile #a8c898, cream tile #f0e8d6, soft grey
grout #888078, slight darker green for the diamond accents #6a8a5a.

Perspective: strict top-down, 90° from directly above.

Composition: tiles laid in a repeating 1980s pattern — small
diamonds set inside larger squares, alternating between pale green
and cream. The pattern reads as deliberately decorative but worn,
slightly faded. Designed to tile seamlessly.

Output rules: single square tile, full frame, tiles seamlessly, no
border, no signature, no text, no chairs/tables/cups (just floor).

EXPLICITLY AVOID: bright pristine tiles, modern porcelain, generic
checker pattern (must read as the specific 1980s diamond motif),
photorealistic, broken tiles.
```

---

## Water

### `marinaWater` — Marina Bay turquoise

Filename: `marina-water.png` · Ref: `parkGrass` (palette anchor).

```
Top-down 1024x1024 pixel-art tile of CALM MARINA BAY WATER seen from
above — bright tropical turquoise, more saturated than a forest pond.
Modern tropical Singapore, the water you see from the Helix Bridge or
Esplanade.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, slightly lower saturation in the deep tones.

Palette: surface turquoise #4ec5c0, deep teal #1a7a82, pale ripple
highlight #a8e8e0.

Perspective: strict top-down, 90° from directly above.

Composition: a calm uniform body of water filling the tile, with
three or four pale curved RIPPLE ARCS scattered across the surface
suggesting gentle current and equatorial sun-glints. No reflections of
buildings, no boats, no foam, no shore — this is the open-water
center tile, designed to tile seamlessly across a large bay.

Output rules: single square tile, full frame, tiles seamlessly, no
border, no signature, no text.

EXPLICITLY AVOID: shorelines, sand, boats, jetties, floating debris,
photorealistic water, dark dramatic ocean, waves with crests, tropical
fish.
```

### `monsoonDrain` — concrete monsoon drain

Filename: `monsoon-drain.png` · Ref: `parkGrass`.

```
Top-down 1024x1024 pixel-art tile of A SINGAPORE MONSOON DRAIN seen
from above — a beige concrete channel running vertically through the
tile, with shallow muddy water at the bottom. The kind of drain that
turns into rapids during a tropical downpour.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain.

Palette: concrete drain wall warm beige #c8b89a, drain wall shadow
#8a7c64, shallow muddy water grey-green #6a7858, faint waterline
streaks darker brown #4a3a2a.

Perspective: strict top-down, 90° from directly above.

Composition: a concrete channel running TOP-TO-BOTTOM through the
tile, occupying most of the tile width. Concrete walls on the left
and right edges with horizontal safety-line ribs. Shallow muddy water
visible at the channel bottom (a thin trickle, not full). NO grass on
the sides — the drain occupies most of the tile. Designed to tile
vertically as a continuous drain.

Output rules: single square tile, full frame, tiles seamlessly
vertically, no border, no signature, no text.

EXPLICITLY AVOID: full-flowing rapid water, photorealistic concrete,
fences, debris, leaves, fish (this is urban drainage), grass on the
sides (the drain occupies the tile).
```

---

## Suggested additions (optional)

These aren't in `lib/tiles.ts` yet — flag any you want and I'll add them to
the registry.

### `beachSand` — Sentosa / ECP beach

Filename: `beach-sand.png` · Ref: `parkGrass` (palette anchor only).

```
Top-down 1024x1024 pixel-art tile of WARM CREAM BEACH SAND — Sentosa
or East Coast Park, fine grain, gently uneven, modern tropical
Singapore.

Style: Stardew Valley pixel-art technique, hand-painted, fine pixel
grain suggesting sand particles, no harsh outlines.

Palette: warm cream sand #e8d8b8, slightly darker grain #c8b08a, very
faint pebbles #a89070.

Perspective: strict top-down, 90° from directly above.

Composition: an even, calm patch of fine sand filling the entire
tile, edge to edge. A few scattered tiny darker pebbles or shell
fragments to break up the texture. No water, no footprints, no
seaweed.

Output rules: single square tile, full frame, tiles seamlessly, no
border, no signature, no text.

EXPLICITLY AVOID: water, footprints, beach umbrellas, seaweed, large
shells dominating the tile, dunes, palm-tree shadows.
```

### `dirtLot` — construction dirt / undeveloped lot

Filename: `dirt-lot.png` · Ref: `parkGrass`.

```
Top-down 1024x1024 pixel-art tile of WARM OCHRE CONSTRUCTION-LOT DIRT
— the kind of bare ground on undeveloped Singapore lots before
foundations are poured. Slightly rutted, scattered with small gravel
and a few bits of construction debris.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering.

Palette: ochre dirt base #a8743a, deeper rutted shadow #6f4a22, dry
highlight #c89a5a, occasional small grey gravel #6a6258.

Perspective: strict top-down, 90° from directly above.

Composition: bare dirt filling the tile, with subtle ruts and small
scattered gravel pebbles. A few faint tire-track impressions. No
plants, no buildings, no construction equipment.

Output rules: single square tile, full frame, tiles seamlessly, no
border, no signature, no text.

EXPLICITLY AVOID: cones, fences, bulldozers, plants, water puddles,
photorealistic dirt, deep mud.
```

### `mrtPlatform` — MRT platform

Filename: `mrt-platform.png` · Ref: `parkGrass`.

```
Top-down 1024x1024 pixel-art tile of AN MRT STATION PLATFORM FLOOR in
modern tropical Singapore — grey polished concrete with a bright
yellow safety stripe running across one edge.

Style: Stardew Valley pixel-art technique, hand-painted, smooth
concrete grain, sharp edge on the yellow stripe.

Palette: cool grey concrete #8a8a86, slightly darker speckling
#6a6a66, bright safety yellow #e8c000, narrow black warning strip
along the yellow #2a2a26.

Perspective: strict top-down, 90° from directly above.

Composition: most of the tile is grey concrete platform floor with
subtle speckling. Along ONE edge (the bottom edge) runs a wide yellow
safety stripe with a thin black border on its inner side, the iconic
"do not cross" line at the platform edge. Designed to tile
horizontally with copies of itself.

Output rules: single square tile, full frame, tiles seamlessly
horizontally, no border, no signature, no text other than the stripe.

EXPLICITLY AVOID: train tracks, train cars, signs, benches, people,
photorealistic concrete, bright lighting effects.
```

### `riverWater` — Singapore River water

Filename: `river-water.png` · Ref: `marinaWater`.

```
Top-down 1024x1024 pixel-art tile of SINGAPORE RIVER WATER — the
calm, slightly grey-green urban channel water seen from Boat Quay or
Clarke Quay, distinct from the brighter Marina Bay turquoise. Modern
tropical Singapore.

Style: Stardew Valley pixel-art technique, hand-painted, gentle
dithering.

Palette: grey-green base #4a7a72, deeper shade #2a5048, faint pale
ripple #8ab8a8, occasional warm-brown silt streak #6a5a3a.

Perspective: strict top-down, 90° from directly above.

Composition: calm channel water filling the tile, with a few subtle
rectangular reflective patches suggesting the still surface of an
urban river. Designed to tile both horizontally and vertically.

Output rules: single square tile, full frame, tiles seamlessly, no
border, no signature, no text.

EXPLICITLY AVOID: bright tropical turquoise (that's marina water),
boats, jetties, photorealistic, dramatic waves.
```

### `parkingLot` — asphalt with parking lines

Filename: `parking-lot.png` · Ref: `roadAsphalt`.

```
Top-down 1024x1024 pixel-art tile of AN ASPHALT CARPARK FLOOR with
white painted parking-bay lines, modern tropical Singapore. Use the
plain asphalt tile as reference for surface texture.

Style: Stardew Valley pixel-art technique, hand-painted, sharp clean
edges on the white lines.

Palette: same warm dark grey asphalt base, plus painted-white #f5f0d8
parking lines (slightly worn).

Perspective: strict top-down, 90° from directly above.

Composition: VERTICAL white parking-bay lines, evenly spaced across
the tile — three or four full bays visible. Lines run from top edge
to bottom edge of the tile (or close to it). NO car icons, NO bay
numbers, NO horizontal lane line. Designed to tile horizontally.

Output rules: single square tile, full frame, tiles seamlessly
horizontally, no border, no signature, no text.

EXPLICITLY AVOID: cars, bay numbers, "P" signs, dashed lines, zebra
crossings, sidewalks inside the tile.
```

---

## What's NOT a base-layer tile

Just to draw the line clearly — these belong in other catalogs, not here:

- **Buildings** (HDB block, hawker centre stall, shophouse) — multi-tile
  footprints with sprites that extend upward. See `buildings.md` (when added).
- **Props** (lamppost, bus stop, bench, bin, bollard) — small decorative
  objects placed on top of base tiles. Separate sprite layer.
- **Vehicles** (bus, taxi, MRT car) — moving objects.
- **Characters / agents** — already handled in `/characters/*.md` and the
  agent sprite system.

If you find yourself wanting to draw a multi-tile feature (building / pond /
plaza) into the base layer, generate it as a multi-tile sprite instead and
place it via the building/prop layer. Don't try to chop it into 1×1 tiles —
the seams will betray you.
