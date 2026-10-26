import { useEffect, useRef } from "react";
import { STEAMPUNK_LAYOUT } from "./steampunk-layout";

type Props = { value: number; target: number };
type Gear = { x: number; y: number; teeth: number; direction: number; phase: number };
type Sprite = { canvas: HTMLCanvasElement; size: number };

const GEARS: Gear[] = STEAMPUNK_LAYOUT.map(([x, y, teeth, direction, phase]) => ({ x, y, teeth, direction, phase }));
const ease = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};

function buildSprites(scale: number): Sprite[] {
  const MOD = 1.5, AD = 3.4, DD = 3.8;
  return GEARS.map((gear, index) => {
    const radius = gear.teeth * MOD;
    const outerRadius = radius + AD + 3;
    const size = Math.ceil(outerRadius * 2 * scale);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return { canvas, size };
    context.translate(size / 2, size / 2);
    context.scale(scale, scale);
    const distance = Math.hypot(gear.x, gear.y);
    if (distance > 230) context.filter = `blur(${1.1 / scale * scale}px)`;
    else if (distance > 170) context.filter = "blur(0.5px)";
    const toothAngle = (Math.PI * 2) / gear.teeth;
    context.beginPath();
    for (let tooth = 0; tooth < gear.teeth; tooth += 1) {
      const center = tooth * toothAngle;
      [[-0.5, radius - DD], [-0.3, radius - DD], [-0.13, radius + AD], [0.13, radius + AD], [0.3, radius - DD], [0.5, radius - DD]].forEach(([offset, toothRadius]) => {
        const angle = center + offset * toothAngle;
        context.lineTo(Math.cos(angle) * toothRadius, Math.sin(angle) * toothRadius);
      });
    }
    context.closePath();
    const gradient = context.createLinearGradient(-radius, -radius, radius, radius);
    gradient.addColorStop(0, "#f3d283"); gradient.addColorStop(0.4, "#b8862b"); gradient.addColorStop(0.7, "#80571c"); gradient.addColorStop(1, "#d9aa4c");
    context.fillStyle = gradient; context.fill(); context.strokeStyle = "rgba(40,22,6,.85)"; context.lineWidth = 1; context.stroke();
    if (index > 0) {
      context.strokeStyle = "rgba(70,40,10,.7)"; context.lineWidth = 1.5; context.beginPath(); context.arc(0, 0, radius * 0.8, 0, Math.PI * 2); context.stroke();
      if (gear.teeth >= 14) {
        context.fillStyle = "#1a100a";
        const holes = gear.teeth >= 28 ? 6 : 4;
        for (let hole = 0; hole < holes; hole += 1) { context.beginPath(); context.arc(Math.cos(hole / holes * Math.PI * 2) * radius * 0.52, Math.sin(hole / holes * Math.PI * 2) * radius * 0.52, radius * 0.15, 0, Math.PI * 2); context.fill(); }
      }
      const hub = context.createRadialGradient(-2, -2, 1, 0, 0, Math.max(radius * 0.25, 5));
      hub.addColorStop(0, "#ffe9a8"); hub.addColorStop(1, "#6a4513"); context.fillStyle = hub; context.beginPath(); context.arc(0, 0, Math.max(radius * 0.2, 3.5), 0, Math.PI * 2); context.fill();
      context.fillStyle = "#2a1a0a"; context.beginPath(); context.arc(0, 0, Math.max(radius * 0.06, 1.2), 0, Math.PI * 2); context.fill();
    } else {
      context.fillStyle = "#2b1a0a"; context.beginPath(); context.arc(0, 0, radius * 0.78, 0, Math.PI * 2); context.fill();
      context.strokeStyle = "rgba(255,220,140,.5)"; context.lineWidth = 2; context.beginPath(); context.arc(0, 0, radius * 0.84, 0, Math.PI * 2); context.stroke();
    }
    return { canvas, size };
  });
}

export default function SteampunkCounter({ value, target }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const valueRef = useRef(value);
  const targetRef = useRef(target);
  const animationStartRef = useRef(-1);
  const waterLevelRef = useRef(0);
  const previousFrameRef = useRef(0);
  const spritesRef = useRef<Sprite[]>([]);

  useEffect(() => {
    // A reset means that the app moved to a new dhikr; only an increment is a press.
    animationStartRef.current = value > valueRef.current ? performance.now() / 1000 : -1;
    valueRef.current = value;
  }, [value]);
  useEffect(() => { targetRef.current = Math.max(1, target); }, [target]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frameId = 0;
    let width = 0, height = 0, scale = 1;
    const bubbles = Array.from({ length: 40 }, () => ({ angle: Math.random() * Math.PI * 2, radius: Math.sqrt(Math.random()) * 290, y: Math.random(), velocity: 0.05 + Math.random() * 0.12, size: 1 + Math.random() * 3 }));
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, rect.width * dpr); height = Math.max(1, rect.height * dpr); scale = Math.min(width, height) / 700;
      canvas.width = Math.ceil(width); canvas.height = Math.ceil(height); spritesRef.current = buildSprites(scale);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const draw = (milliseconds: number) => {
      const now = milliseconds / 1000;
      const delta = Math.min(0.05, previousFrameRef.current ? now - previousFrameRef.current : 0.016); previousFrameRef.current = now;
      const centerX = width / 2, centerY = height / 2, ratio = Math.min(1, Math.max(0, valueRef.current / Math.max(1, targetRef.current)));
      const start = animationStartRef.current < 0 ? now : animationStartRef.current;
      const elapsed = now - start;
      const rotation = 180 * Math.min(elapsed, 0.25) ** 2 / (2 * 0.25) + (elapsed > 0.25 ? 180 * (Math.min(elapsed, 1.8) - 0.25) : 0);
      const currentWater = waterLevelRef.current + (ratio - waterLevelRef.current) * Math.min(1, delta * 2.2); waterLevelRef.current = currentWater;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#120a05"; context.beginPath(); context.arc(centerX, centerY, 332 * scale, 0, Math.PI * 2); context.fill();
      GEARS.forEach((gear, index) => { const sprite = spritesRef.current[index]; if (!sprite) return; const angle = gear.phase + gear.direction * (rotation * Math.PI / 180) * 59 / gear.teeth; context.save(); context.translate(centerX + gear.x * scale, centerY + gear.y * scale); context.rotate(angle); context.drawImage(sprite.canvas, -sprite.size / 2, -sprite.size / 2); context.restore(); });
      context.save(); context.globalCompositeOperation = "soft-light"; const light = context.createLinearGradient(centerX - 300 * scale, centerY - 300 * scale, centerX + 300 * scale, centerY + 300 * scale); light.addColorStop(0, "rgba(255,255,255,.55)"); light.addColorStop(1, "rgba(0,0,0,.6)"); context.fillStyle = light; context.beginPath(); context.arc(centerX, centerY, 300 * scale, 0, Math.PI * 2); context.fill(); context.restore();
      const radius = 300 * scale, top = centerY + radius - currentWater * (2 * radius + 40 * scale), ripple = Math.max(0, 1 - elapsed / 1.6) * 5 * scale, amplitude = (currentWater > 0.985 ? 0 : 2.2 * scale) + ripple;
      if (currentWater > 0.001) {
        context.save(); context.beginPath(); context.arc(centerX, centerY, radius, 0, Math.PI * 2); context.clip(); context.beginPath(); context.moveTo(centerX - radius - 5, centerY + radius + 5);
        for (let x = -radius; x <= radius; x += 8 * scale) context.lineTo(centerX + x, top + Math.sin(x / scale * 0.035 + now * 2.2) * amplitude + Math.sin(x / scale * 0.09 - now * 1.7) * amplitude * 0.4);
        context.lineTo(centerX + radius + 5, centerY + radius + 5); context.closePath(); const water = context.createLinearGradient(0, top, 0, centerY + radius); water.addColorStop(0, "rgba(120,205,235,.34)"); water.addColorStop(1, "rgba(8,55,105,.62)"); context.fillStyle = water; context.fill(); context.strokeStyle = "rgba(210,245,255,.6)"; context.lineWidth = 2 * scale; context.stroke();
        context.globalCompositeOperation = "screen"; context.strokeStyle = "rgba(150,220,255,.10)"; context.lineWidth = 5 * scale;
        for (let band = 0; band < 7; band += 1) { context.beginPath(); for (let x = -radius; x <= radius; x += 14 * scale) { const y = centerY - radius + (band + 0.5) * (2 * radius / 7) + Math.sin(x / scale * 0.03 + now * 0.8 + band) * 12 * scale; if (x === -radius) context.moveTo(centerX + x, y); else context.lineTo(centerX + x, y); } context.stroke(); }
        context.globalCompositeOperation = "source-over"; bubbles.forEach((bubble) => { bubble.y -= bubble.velocity * delta; if (bubble.y < 0) bubble.y = 1; const x = centerX + Math.cos(bubble.angle) * bubble.radius * scale + Math.sin(now * 2 + bubble.angle * 5) * 3 * scale, y = centerY + radius - bubble.y * 2 * radius; if (y > top + 6 * scale) { context.strokeStyle = "rgba(220,245,255,.55)"; context.lineWidth = scale; context.beginPath(); context.arc(x, y, bubble.size * scale, 0, Math.PI * 2); context.stroke(); } }); context.restore();
      }
      const displayRadius = 66 * scale;
      const displayGradient = context.createLinearGradient(centerX - displayRadius, centerY - displayRadius, centerX + displayRadius, centerY + displayRadius);
      displayGradient.addColorStop(0, "#f0cd78"); displayGradient.addColorStop(0.5, "#8a5f1e"); displayGradient.addColorStop(1, "#d9ae52");
      context.fillStyle = displayGradient; context.beginPath(); context.arc(centerX, centerY, displayRadius + 7 * scale, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#060202"; context.beginPath(); context.arc(centerX, centerY, displayRadius, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#ffe9a8"; context.font = `700 ${Math.max(18, 42 * scale)}px monospace`; context.textAlign = "center"; context.textBaseline = "middle"; context.shadowColor = "rgba(255,120,30,.85)"; context.shadowBlur = 9 * scale; context.fillText(String(valueRef.current), centerX, centerY + 1 * scale); context.shadowBlur = 0;
      const domeRadius = 332 * scale; context.save(); const rim = context.createLinearGradient(centerX - domeRadius, centerY - domeRadius, centerX + domeRadius, centerY + domeRadius); rim.addColorStop(0, "#f6d98a"); rim.addColorStop(0.5, "#6f4a1a"); rim.addColorStop(1, "#e8c46a"); context.strokeStyle = rim; context.lineWidth = 26 * scale; context.beginPath(); context.arc(centerX, centerY, domeRadius + 4 * scale, 0, Math.PI * 2); context.stroke(); context.fillStyle = "#3a2410"; for (let dot = 0; dot < 24; dot += 1) { const angle = dot / 24 * Math.PI * 2; context.beginPath(); context.arc(centerX + Math.cos(angle) * (domeRadius + 4 * scale), centerY + Math.sin(angle) * (domeRadius + 4 * scale), 3.2 * scale, 0, Math.PI * 2); context.fill(); } const glass = context.createRadialGradient(centerX - domeRadius * 0.35, centerY - domeRadius * 0.45, domeRadius * 0.05, centerX, centerY, domeRadius); glass.addColorStop(0, "rgba(255,255,255,.30)"); glass.addColorStop(0.3, "rgba(255,255,255,.04)"); glass.addColorStop(0.85, "rgba(120,180,200,.05)"); glass.addColorStop(1, "rgba(255,255,255,.25)"); context.fillStyle = glass; context.beginPath(); context.arc(centerX, centerY, domeRadius, 0, Math.PI * 2); context.fill(); context.strokeStyle = "rgba(255,240,200,.4)"; context.lineWidth = 2.5 * scale; context.stroke(); context.fillStyle = "rgba(255,255,255,.22)"; context.beginPath(); context.ellipse(centerX - domeRadius * 0.42, centerY - domeRadius * 0.62, domeRadius * 0.28, domeRadius * 0.08, -0.7, 0, Math.PI * 2); context.fill(); context.restore();
      frameId = requestAnimationFrame(draw);
    };
    frameId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frameId); observer.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="steampunk-counter-canvas" aria-hidden="true" />;
}
