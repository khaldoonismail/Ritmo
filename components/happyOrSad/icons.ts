// Happy or Sad's two answer pictures, drawn in code (not emoji) so they
// look the same on every device: ☀️ a sun (happy / major) and 🌧️ a rain
// cloud (sad / minor).

const SUN = "#FFC23D";
const SUN_DARK = "#F28C28";
const RAIN_BG = "#5B7FD6";
const CLOUD = "#EEF3FB";

function disc(bg: string): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = bg;
  g.beginPath();
  g.arc(64, 64, 54, 0, Math.PI * 2);
  g.fill();
  return { c, g };
}

// The two answers as images, for the buttons and the card.
export function signImage(kind: "sunny" | "rainy"): string {
  return (kind === "sunny" ? sunCanvas() : rainCanvas()).toDataURL();
}

// ☀️ A sun with rays on a sky-blue disc.
function sunCanvas(): HTMLCanvasElement {
  const { c, g } = disc("#7CCBF2");
  g.translate(64, 64);
  g.fillStyle = SUN;
  for (let i = 0; i < 8; i++) {
    g.save();
    g.rotate((i * Math.PI) / 4);
    g.beginPath();
    g.moveTo(-7, -26);
    g.lineTo(0, -44);
    g.lineTo(7, -26);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.beginPath();
  g.arc(0, 0, 21, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = SUN_DARK;
  g.beginPath();
  g.arc(0, 0, 21, 0, Math.PI * 2);
  g.lineWidth = 4;
  g.strokeStyle = SUN_DARK;
  g.stroke();
  return c;
}

// 🌧️ A cloud with rain drops on a blue disc.
function rainCanvas(): HTMLCanvasElement {
  const { c, g } = disc(RAIN_BG);
  g.fillStyle = CLOUD;
  for (const [x, y, r] of [
    [46, 58, 17],
    [66, 48, 21],
    [86, 58, 16],
  ] as const) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillRect(36, 56, 58, 18);
  g.strokeStyle = "#BFE3FF";
  g.lineWidth = 6;
  g.lineCap = "round";
  for (const x of [46, 64, 82]) {
    g.beginPath();
    g.moveTo(x, 84);
    g.lineTo(x - 6, 100);
    g.stroke();
  }
  return c;
}
