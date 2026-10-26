import { useEffect, useRef } from "react";

type Variant = "crescent" | "tree" | "lantern";
type Props = { variant: Variant; value: number; target: number };

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const seeded = (seed: number) => { let value = seed | 0; return () => { value = (value + 0x6d2b79f5) | 0; let t = Math.imul(value ^ (value >>> 15), 1 | value); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2); ctx.fill(); };

export default function SubhaCounter({ variant, value, target }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const valueRef = useRef(value);
  const targetRef = useRef(Math.max(1, target));
  const startedRef = useRef(-1);

  useEffect(() => { startedRef.current = value > valueRef.current ? performance.now() : -1; valueRef.current = value; }, [value]);
  useEffect(() => { targetRef.current = Math.max(1, target); }, [target]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let width = 1, height = 1, dpr = 1;
    const random = seeded(variant === "crescent" ? 3 : variant === "tree" ? 7 : 11);
    const stars = Array.from({ length: 52 }, () => ({ x: random(), y: random(), r: 0.5 + random() * 1.5, phase: random() * Math.PI * 2 }));
    const flowers = Array.from({ length: 100 }, () => ({ x: (random() - 0.5) * 0.88, y: -0.18 - random() * 0.56, size: 0.4 + random() * 0.7 }));
    const embers = Array.from({ length: 48 }, () => ({ x: random() - 0.5, y: random(), phase: random() * 10 }));
    const resize = () => { const rect = canvas.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); width = Math.max(1, rect.width); height = Math.max(1, rect.height); canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr); context.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const draw = (milliseconds: number) => {
      const now = milliseconds / 1000, ratio = clamp(valueRef.current / targetRef.current), cx = width / 2, cy = height / 2, radius = Math.min(width, height) * 0.5;
      context.clearRect(0, 0, width, height); context.save(); context.beginPath(); context.arc(cx, cy, radius, 0, Math.PI * 2); context.clip();
      const background = context.createRadialGradient(cx - radius * 0.2, cy - radius * 0.3, 0, cx, cy, radius); background.addColorStop(0, variant === "crescent" ? "#273b83" : variant === "tree" ? "#385b66" : "#49245c"); background.addColorStop(1, variant === "crescent" ? "#070b1f" : variant === "tree" ? "#0d252c" : "#100814"); context.fillStyle = background; context.fillRect(0, 0, width, height);
      if (variant === "crescent") {
        stars.forEach((star) => { context.globalAlpha = 0.2 + ratio * 0.7 + Math.sin(now * 1.4 + star.phase) * 0.08; context.fillStyle = "#fff0bc"; circle(context, star.x * width, star.y * height, star.r * (0.6 + ratio * 0.5)); }); context.globalAlpha = 1;
        const moonX = cx, moonY = cy - radius * 0.07, moonR = radius * 0.33; const moon = context.createRadialGradient(moonX - moonR * 0.35, moonY - moonR * 0.4, 0, moonX, moonY, moonR); moon.addColorStop(0, "#fff4c8"); moon.addColorStop(1, "#d6a84f"); context.fillStyle = moon; context.beginPath(); context.arc(moonX, moonY, moonR, 0, Math.PI * 2); context.fill(); context.fillStyle = "#17265f"; context.beginPath(); context.arc(moonX + moonR * 0.34, moonY - moonR * 0.16, moonR * 0.94, 0, Math.PI * 2); context.fill();
        for (let index = 0; index < Math.max(1, Math.floor(ratio * 18)); index += 1) { const angle = -Math.PI * 0.84 + index / 18 * Math.PI * 1.68; context.fillStyle = "#ffe5a0"; circle(context, moonX + Math.cos(angle) * moonR * 0.9, moonY + Math.sin(angle) * moonR * 0.9, 1.5 + ratio * 1.6); }
      } else if (variant === "tree") {
        const baseY = cy + radius * 0.42, scale = radius * 0.8; context.lineCap = "round"; context.strokeStyle = "#6d432b"; context.lineWidth = Math.max(3, radius * 0.045); context.beginPath(); context.moveTo(cx, baseY); context.lineTo(cx, baseY - scale * 0.48); context.moveTo(cx, baseY - scale * 0.28); context.lineTo(cx - scale * 0.32, baseY - scale * 0.63); context.moveTo(cx, baseY - scale * 0.36); context.lineTo(cx + scale * 0.34, baseY - scale * 0.72); context.moveTo(cx - scale * 0.14, baseY - scale * 0.45); context.lineTo(cx - scale * 0.5, baseY - scale * 0.76); context.moveTo(cx + scale * 0.17, baseY - scale * 0.5); context.lineTo(cx + scale * 0.52, baseY - scale * 0.82); context.stroke();
        flowers.forEach((flower, index) => { if (index >= Math.floor(ratio * flowers.length)) return; const x = cx + flower.x * scale, y = baseY + flower.y * scale; const size = Math.max(1.5, radius * 0.027 * flower.size); context.fillStyle = index % 3 ? "#ffc2d1" : "#fff0f3"; for (let petal = 0; petal < 5; petal += 1) { context.beginPath(); context.arc(x + Math.cos(petal * 1.256) * size * 0.75, y + Math.sin(petal * 1.256) * size * 0.75, size * 0.64, 0, Math.PI * 2); context.fill(); } context.fillStyle = "#e8718d"; circle(context, x, y, size * 0.35); });
      } else {
        const lanternWidth = radius * 0.58, lanternTop = cy - radius * 0.5, lanternHeight = radius * 1.02, lanternLeft = cx - lanternWidth / 2, glow = context.createRadialGradient(cx, cy, 0, cx, cy, radius * (0.45 + ratio * 1.1)); glow.addColorStop(0, `rgba(255,160,55,${0.18 + ratio * 0.55})`); glow.addColorStop(1, "rgba(40,12,60,0)"); context.fillStyle = glow; circle(context, cx, cy, radius); context.strokeStyle = "#d5a547"; context.lineWidth = Math.max(2, radius * 0.025); context.beginPath(); context.moveTo(cx, cy - radius); context.lineTo(cx, lanternTop - radius * 0.08); context.stroke(); context.fillStyle = "#b8862b"; context.beginPath(); context.moveTo(lanternLeft - radius * 0.06, lanternTop); context.lineTo(cx, lanternTop - radius * 0.13); context.lineTo(lanternLeft + lanternWidth + radius * 0.06, lanternTop); context.closePath(); context.fill(); const body = context.createRadialGradient(cx, lanternTop + lanternHeight * 0.48, 0, cx, lanternTop + lanternHeight * 0.48, lanternWidth); body.addColorStop(0, `hsl(${28 + ratio * 22},100%,${70 + ratio * 20}%)`); body.addColorStop(0.5, `hsl(${28 + ratio * 22},95%,${42 + ratio * 12}%)`); body.addColorStop(1, "#321526"); context.fillStyle = body; context.beginPath(); context.roundRect(lanternLeft, lanternTop, lanternWidth, lanternHeight, lanternWidth * 0.16); context.fill(); context.strokeStyle = "#b8862b"; context.lineWidth = Math.max(2, radius * 0.035); for (const position of [0, 0.33, 0.67, 1]) { context.beginPath(); context.moveTo(lanternLeft + lanternWidth * position, lanternTop); context.lineTo(lanternLeft + lanternWidth * position, lanternTop + lanternHeight); context.stroke(); } embers.forEach((ember) => { const y = lanternTop + lanternHeight - ((now * 0.05 + ember.phase) % 1.1) * lanternHeight; context.fillStyle = `rgba(255,230,150,${0.2 + ratio * 0.7})`; circle(context, cx + ember.x * lanternWidth * 2.2, y, 1 + ratio * 1.5); });
      }
      const number = String(valueRef.current); context.fillStyle = "rgba(5,9,24,.78)"; context.fillRect(cx - radius * 0.42, cy + radius * 0.31, radius * 0.84, radius * 0.23); context.fillStyle = "#ffe9a8"; context.font = `700 ${Math.max(16, radius * 0.22)}px Cairo, sans-serif`; context.textAlign = "center"; context.textBaseline = "middle"; context.shadowColor = "rgba(255,210,122,.65)"; context.shadowBlur = radius * 0.08; context.fillText(number, cx, cy + radius * 0.425); context.shadowBlur = 0; context.restore();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw); return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [variant]);

  return <canvas ref={canvasRef} className="subha-counter-canvas" aria-hidden="true" />;
}
