import { OUTFITS, SKIN_TONES, type CharacterChoice, type CharacterKind } from "./choice";

// The Ritmo runners (boy, girl, cat, fox and Ritmo the eighth note), drawn
// in code as flat SVG. Original designs. Style rules, the same for every
// character:
//   - simple confident shapes, one outline weight everywhere (SW)
//   - flat colour + ONE soft shadow shape + ONE highlight shape per part
//     (no gradients); back limbs a shade darker for depth
//   - same proportions: head r = 58 centred at (100, 80), same body and
//     limbs; the same big eyes and mouths for all
//
// Each character is a cut-out puppet: separate parts (tail, back leg, back
// arm, front leg, torso, head, front arm) plus a face layer swapped per
// expression. ./pose.ts moves the parts; ./SvgPuppet.tsx draws them as SVG
// and ./SpriteCharacter.ts as flat layers in the 3D games (2.5D). An
// illustrator's artwork can replace any part: same canvas, same pivots.
//
// Canvas: 200 × 240, feet on y = 240, facing right (+x).

export const INK = "#2B2745";
const SW = 6; // the one outline weight
const CHEEK = "#FF8FA3";
const WHITE = "#FFFFFF";

export type Role = "legB" | "armB" | "tail" | "torso" | "legF" | "head" | "armF";
export const ROLES_BACK_TO_FRONT: Role[] = ["tail", "legB", "armB", "legF", "torso", "head", "armF"];

export type Expression = "idle" | "blink" | "happy" | "sad" | "bump";
export const EXPRESSIONS: Expression[] = ["idle", "blink", "happy", "sad", "bump"];
export type Fx = "none" | "sparkle" | "tear" | "stars";

export interface PuppetArt {
  parts: Partial<Record<Role, string>>;
  pivots: Record<Role | "hips", [number, number]>;
  face: (e: Expression) => string;
  fx: (f: Fx, t: number) => string;
  // Where effects sit: above the head (sparkles, stars) and the tear.
  anchors: { top: [number, number]; tear: [number, number] };
}

// --- colour helpers --------------------------------------------------

function mix(hex: string, other: string, k: number) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(other.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}
const shadow = (c: string) => mix(c, "#2B2745", 0.22);
const light = (c: string) => mix(c, "#FFFFFF", 0.38);

// --- the shape kit ---------------------------------------------------

// Clip ids come from the shape itself, so server and browser render the
// same markup (and identical shapes can share one clip).
function clipId(d: string, t = "") {
  let h = 5381;
  const str = d + t;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return `rc${(h >>> 0).toString(36)}`;
}

// One part shape: flat fill, a shadow crescent along the lower-right edge
// (the shape in its shadow colour, covered by itself shifted up-left), one
// highlight shape, optional extra flat shapes inside, then the outline.
function shape(
  d: string,
  fill: string,
  o: { hl?: string; extra?: string; shift?: [number, number]; flat?: boolean; transform?: string } = {}
) {
  const id = clipId(d, o.transform);
  const [sx, sy] = o.shift ?? [7, 7];
  const inner =
    (o.flat ? "" : `<path d="${d}" transform="translate(${-sx} ${-sy})" fill="${fill}"/>`) + (o.extra ?? "") + (o.hl ?? "");
  const body = `<clipPath id="${id}"><path d="${d}"/></clipPath>
<path d="${d}" fill="${o.flat ? fill : shadow(fill)}"/>
<g clip-path="url(#${id})">${inner}</g>
<path d="${d}" fill="none" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"/>`;
  return o.transform ? `<g transform="${o.transform}">${body}</g>` : body;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 z`;
const pill = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(w, h) / 2;
  return `M${x + r} ${y} h${w - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} v${h - 2 * r} a${r} ${r} 0 0 1 ${-r} ${r} h${-(w - 2 * r)} a${r} ${r} 0 0 1 ${-r} ${-r} v${-(h - 2 * r)} a${r} ${r} 0 0 1 ${r} ${-r} z`;
};
const hlBlob = (cx: number, cy: number, rx: number, ry: number, c: string, rot = -30) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${light(c)}" transform="rotate(${rot} ${cx} ${cy})"/>`;

// Arm: one capsule with a round hand. Back limbs use the shadow colour.
function arm(px: number, py: number, sleeve: string, hand: string, back: boolean, len = 40) {
  const s = back ? shadow(sleeve) : sleeve;
  const h = back ? shadow(hand) : hand;
  return shape(pill(px - 10, py - 8, 20, len + 4), s, { flat: true }) + shape(circle(px, py + len, 12), h, { flat: true });
}

// Leg with a rounded shoe pointing forward; feet end on y = 240.
function leg(px: number, py: number, color: string, shoe: string, back: boolean) {
  const c = back ? shadow(color) : color;
  const sh = back ? shadow(shoe) : shoe;
  const len = 236 - 14 - py;
  return (
    shape(pill(px - 10, py - 6, 20, len + 10), c, { flat: true }) +
    shape(`M${px - 13} 237 q0 -16 16 -16 h4 q16 0 16 14 v2 z`, sh, { flat: true })
  );
}

// The same body for the boy, cat and fox.
const BODY = pill(72, 122, 56, 76);
function torsoBasic(fill: string, extra = "") {
  return shape(BODY, fill, { hl: `<rect x="80" y="132" width="10" height="26" rx="5" fill="${light(fill)}"/>`, extra });
}

const HEAD = circle(100, 80, 58);
const headHl = (c: string) => hlBlob(72, 50, 14, 9, c);

// --- faces ------------------------------------------------------------

interface FaceSpot {
  eyes: [[number, number], [number, number]];
  mouth: [number, number];
  cheeks: [[number, number], [number, number]];
  lid: string; // colour around the eyes (droopy eyelids for "sad")
}

const line = (d: string, w = SW) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

function makeFace(f: FaceSpot) {
  return (e: Expression) => {
    let out = f.cheeks
      .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="7" fill="${CHEEK}" opacity="${e === "sad" ? 0.45 : 0.85}"/>`)
      .join("");
    f.eyes.forEach(([x, y], i) => {
      const outer = i === 0 ? -1 : 1; // which side is the outer corner
      if (e === "idle") {
        out += `<ellipse cx="${x}" cy="${y}" rx="12" ry="15" fill="${INK}"/><circle cx="${x + 4}" cy="${y - 5}" r="5" fill="${WHITE}"/>`;
      } else if (e === "blink") {
        out += line(`M${x - 12} ${y + 2} q12 9 24 0`);
      } else if (e === "happy") {
        out += line(`M${x - 13} ${y + 4} q13 -18 26 0`);
      } else if (e === "sad") {
        // Droopy: a half-closed lid sloping down to the outer corner.
        const yo = y - 1 + 0;
        const yi = y - 9;
        const [ly, ry] = outer < 0 ? [yo, yi] : [yi, yo];
        out += `<ellipse cx="${x}" cy="${y + 2}" rx="11" ry="13" fill="${INK}"/><circle cx="${x + 4}" cy="${y + 2}" r="4" fill="${WHITE}"/>
<path d="M${x - 17} ${ly} L${x + 17} ${ry} L${x + 17} ${y - 22} L${x - 17} ${y - 22} Z" fill="${f.lid}"/>` +
          line(`M${x - 14} ${ly + (ry - ly) * 0.1} L${x + 14} ${ry - (ry - ly) * 0.1}`) +
          // Brows tilted up toward the middle: the classic sad look.
          (outer < 0 ? line(`M${x - 12} ${y - 19} L${x + 10} ${y - 28}`) : line(`M${x - 10} ${y - 28} L${x + 12} ${y - 19}`));
      } else {
        // bump: a big wince, > <
        const d = outer < 0 ? `M${x - 11} ${y - 10} L${x + 9} ${y} L${x - 11} ${y + 10}` : `M${x + 11} ${y - 10} L${x - 9} ${y} L${x + 11} ${y + 10}`;
        out += line(d);
      }
    });
    const [mx, my] = f.mouth;
    if (e === "happy") {
      out += `<path d="M${mx - 18} ${my - 4} h36 q0 26 -18 26 q-18 0 -18 -26 z" fill="${INK}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M${mx - 9} ${my + 15} q9 -9 18 0 q-9 6 -18 0 z" fill="#FF6B81"/>`;
    } else if (e === "sad") {
      out += line(`M${mx - 12} ${my + 8} q12 -12 24 0`);
    } else if (e === "bump") {
      out += `<ellipse cx="${mx}" cy="${my + 4}" rx="8" ry="10" fill="${INK}"/>`;
    } else {
      out += line(`M${mx - 13} ${my - 2} q13 14 26 0`);
    }
    return out;
  };
}

// Sparkles (cheer), a tear (sad) or stars circling the head (bump).
function makeFx(top: [number, number], tearAt: [number, number]) {
  const star = (x: number, y: number, r: number, c: string) =>
    `<path d="M${x} ${y - r} Q${x + r * 0.25} ${y - r * 0.25} ${x + r} ${y} Q${x + r * 0.25} ${y + r * 0.25} ${x} ${y + r} Q${x - r * 0.25} ${y + r * 0.25} ${x - r} ${y} Q${x - r * 0.25} ${y - r * 0.25} ${x} ${y - r} z" fill="${c}" stroke="${INK}" stroke-width="${SW - 1}" stroke-linejoin="round"/>`;
  return (f: Fx, t: number) => {
    const [hx, hy] = top;
    if (f === "sparkle") {
      const k = 0.85 + Math.sin(t * 10) * 0.15;
      return star(hx - 70, hy + 34, 15 * k, "#FFD23F") + star(hx + 74, hy + 18, 17 * k, "#FFD23F") + star(hx + 44, hy - 26, 11 * k, "#7FE7FF");
    }
    if (f === "tear") {
      const [x, y] = tearAt;
      const d = (t * 30) % 26;
      return `<path d="M${x} ${y + d} q-11 15 0 21 q11 -6 0 -21 z" fill="#7FD3FF" stroke="${INK}" stroke-width="${SW - 1}" stroke-linejoin="round" opacity="${1 - d / 32}"/>`;
    }
    if (f === "stars") {
      let s = "";
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        s += star(hx + Math.cos(a) * 52, hy - 4 + Math.sin(a) * 13, 12, i === 1 ? "#7FE7FF" : "#FFD23F");
      }
      return s;
    }
    return "";
  };
}

const PIVOTS: PuppetArt["pivots"] = {
  legB: [93, 194],
  legF: [108, 194],
  armB: [88, 142],
  armF: [112, 142],
  tail: [76, 184],
  torso: [100, 196],
  head: [100, 136],
  hips: [100, 198],
};

// Shared face spot for the boy, girl and cat (same eyes, same place).
const FACE: Omit<FaceSpot, "lid"> = { eyes: [[110, 84], [142, 84]], mouth: [128, 112], cheeks: [[98, 104], [152, 102]] };

// --- the characters ----------------------------------------------------

function boy(skin: string, main: string): PuppetArt {
  const hair = "#3A2618";
  // Hair is drawn inside the head outline (clipped to it); only the
  // fringe edge gets a line, so there are never gaps.
  const fringe = "M40 98 C46 72 58 62 72 64 C80 52 94 50 104 58 C118 50 142 56 162 74";
  const head =
    shape(circle(64, 90, 12), skin, { flat: true }) +
    shape(HEAD, skin, {
      extra: `${headHl(skin)}<path d="${fringe} L180 74 L180 0 L20 0 L20 98 Z" fill="${hair}"/>${hlBlob(68, 40, 10, 5, hair, -35)}${line(fringe)}`,
    });
  return {
    parts: {
      legB: leg(93, 194, "#33408C", WHITE, true),
      legF: leg(108, 194, "#3D4DA6", WHITE, false),
      armB: arm(88, 142, main, skin, true),
      armF: arm(112, 142, main, skin, false),
      torso: torsoBasic(main),
      head,
    },
    pivots: PIVOTS,
    face: makeFace({ ...FACE, lid: skin }),
    fx: makeFx([104, 22], [158, 94]),
    anchors: { top: [104, 22], tear: [158, 94] },
  };
}

function girl(skin: string, main: string, accent: string): PuppetArt {
  const hair = "#4A2A1C";
  // Long hair falling down the back, a bun with a bow, a side-swept
  // fringe (drawn inside the head outline, like the boy's).
  const fringe = "M40 100 C42 62 70 40 106 40 C114 56 134 68 162 76";
  const head =
    shape(pill(30, 58, 40, 86), hair, { flat: true }) +
    shape(circle(52, 30, 22), hair, { flat: true }) +
    shape(ellipse(70, 40, 15, 9), accent, { flat: true, transform: "rotate(-35 70 40)" }) +
    shape(HEAD, skin, {
      extra: `${headHl(skin)}<path d="${fringe} L180 76 L180 0 L20 0 L20 100 Z" fill="${hair}"/>${hlBlob(70, 46, 10, 5, hair, -35)}${line(fringe)}`,
    });
  const dress = "M86 122 h28 q12 0 14 12 l10 48 q2 14 -12 14 h-52 q-14 0 -12 -14 l10 -48 q2 -12 14 -12 z";
  return {
    parts: {
      legB: leg(93, 194, skin, accent, true),
      legF: leg(108, 194, skin, accent, false),
      armB: arm(88, 142, main, skin, true, 38),
      armF: arm(112, 142, main, skin, false, 38),
      torso: shape(dress, main, { hl: `<rect x="86" y="132" width="10" height="24" rx="5" fill="${light(main)}"/>` }),
      head,
    },
    pivots: PIVOTS,
    face: makeFace({ ...FACE, lid: skin }),
    fx: makeFx([104, 22], [158, 94]),
    anchors: { top: [104, 22], tear: [158, 94] },
  };
}

function cat(): PuppetArt {
  const fur = "#FFA94D";
  const cream = "#FFF1DD";
  const pink = "#FF9DB0";
  const ear = (d: string, inner: string) => shape(d, fur, { flat: true, extra: `<path d="${inner}" fill="${pink}"/>` });
  const head =
    ear("M54 66 L60 14 L98 44 Z", "M62 52 L65 30 L82 44 Z") +
    ear("M116 42 L150 14 L154 66 Z", "M126 44 L144 30 L146 56 Z") +
    shape(HEAD, fur, { hl: headHl(fur) }) +
    shape(ellipse(130, 108, 26, 17), cream, { flat: true }) +
    `<path d="M124 99 h12 l-6 7 z" fill="${INK}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  const tailD = "M78 186 C42 190 32 152 42 126 C48 110 62 106 66 118";
  const tail = line(tailD, 26) + `<path d="${tailD}" fill="none" stroke="${fur}" stroke-width="14" stroke-linecap="round"/>`;
  return {
    parts: {
      tail,
      legB: leg(93, 194, fur, cream, true),
      legF: leg(108, 194, fur, cream, false),
      armB: arm(88, 142, fur, cream, true),
      armF: arm(112, 142, fur, cream, false),
      torso: torsoBasic(fur, `<path d="${ellipse(110, 168, 16, 22)}" fill="${cream}"/>`),
      head,
    },
    pivots: PIVOTS,
    face: makeFace({ eyes: [[108, 80], [140, 80]], mouth: [130, 118], cheeks: [[94, 100], [156, 98]], lid: fur }),
    fx: makeFx([104, 18], [156, 90]),
    anchors: { top: [104, 18], tear: [156, 90] },
  };
}

function fox(): PuppetArt {
  const fur = "#FF7A3D";
  const white = "#FFF6EC";
  const dark = "#4A2E2A";
  const ear = (d: string, inner: string) => shape(d, fur, { flat: true, extra: `<path d="${inner}" fill="${dark}"/>` });
  const head =
    ear("M50 64 L52 6 L94 42 Z", "M56 46 L56 20 L76 38 Z") +
    ear("M114 40 L148 4 L156 62 Z", "M126 40 L144 20 L148 50 Z") +
    shape(HEAD, fur, { hl: headHl(fur) }) +
    shape("M110 96 C140 90 168 94 186 104 C190 110 186 116 180 118 C158 126 130 126 110 118 C102 112 102 100 110 96 Z", white, { flat: true }) +
    shape(circle(184, 108, 8), INK, { flat: true });
  const tailD = "M80 186 C44 200 8 176 12 136 C14 112 40 102 56 118 C66 130 68 164 80 186 Z";
  const tail = shape(tailD, fur, { extra: `<circle cx="14" cy="124" r="30" fill="${white}"/>` });
  return {
    parts: {
      tail,
      legB: leg(93, 194, dark, dark, true),
      legF: leg(108, 194, dark, dark, false),
      armB: arm(88, 142, fur, dark, true),
      armF: arm(112, 142, fur, dark, false),
      torso: torsoBasic(fur, `<path d="M100 124 q16 0 18 16 q-4 24 -12 32 q-10 -14 -12 -32 q0 -14 6 -16 z" fill="${white}"/>`),
      head,
    },
    pivots: { ...PIVOTS, tail: [80, 184] },
    face: makeFace({ eyes: [[104, 78], [136, 74]], mouth: [150, 122], cheeks: [[90, 98], [158, 92]], lid: fur }),
    fx: makeFx([100, 12], [140, 90]),
    anchors: { top: [100, 12], tear: [140, 90] },
  };
}

// Ritmo: an eighth note. The tilted note head is the body (with the face),
// the stem rises from its right side and the flag curls off the top.
function note(): PuppetArt {
  const blue = "#4F5DFF";
  const yellow = "#FFC93D";
  const stemD = pill(146, 22, 18, 118);
  const head =
    shape(stemD, blue, { flat: true }) +
    shape("M160 22 C192 34 204 62 192 92 C186 74 174 64 160 60 Z", yellow, { hl: hlBlob(172, 38, 8, 4, yellow, 30), shift: [5, 5] }) +
    shape(ellipse(100, 150, 70, 52), blue, { hl: hlBlob(64, 136, 16, 9, blue, 0), transform: "rotate(-18 100 150)" });
  return {
    parts: {
      legB: leg(90, 196, blue, "#FF5A5F", true),
      legF: leg(110, 196, blue, "#FF5A5F", false),
      armB: arm(40, 156, blue, WHITE, true, 32),
      armF: arm(160, 150, blue, WHITE, false, 32),
      head,
    },
    pivots: { ...PIVOTS, armB: [40, 156], armF: [160, 150], legB: [90, 196], legF: [110, 196], head: [100, 198] },
    face: makeFace({ eyes: [[96, 146], [128, 140]], mouth: [116, 170], cheeks: [[78, 168], [146, 160]], lid: blue }),
    fx: makeFx([100, 70], [140, 154]),
    anchors: { top: [100, 70], tear: [140, 154] },
  };
}

export function puppetArt(choice: CharacterChoice): PuppetArt {
  const skin = SKIN_TONES[choice.skin] ?? SKIN_TONES[1];
  const outfit = OUTFITS[choice.outfit] ?? OUTFITS[0];
  const k: CharacterKind = choice.kind;
  if (k === "girl") return girl(skin, outfit.main, outfit.accent);
  if (k === "cat") return cat();
  if (k === "fox") return fox();
  if (k === "note") return note();
  return boy(skin, outfit.main);
}

// Visible area around the 200 × 240 canvas (room for a cheer jump, raised
// arms, tails and stars).
export const VIEW = { x: -40, y: -80, w: 280, h: 330 };
