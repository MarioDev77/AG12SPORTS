'use client';

import { useEffect, useRef } from 'react';

const DOT_COUNT = 70;
const AMBER = '#e8a84a';

/**
 * Poeira dourada subindo lentamente na escuridão da abertura. Portado do
 * protótipo em public/ag12-abertura.html (canvas leve, dpr limitado,
 * render estático quando o usuário prefere movimento reduzido).
 */
export default function ParticleField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let raf = 0;
    let dots = [];

    function spawn() {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.8 + 0.4,
        vy: Math.random() * 0.4 + 0.1,
        vx: (Math.random() - 0.5) * 0.3,
        a: Math.random() * 0.6 + 0.2,
      };
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = Array.from({ length: DOT_COUNT }, spawn);
    }

    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = AMBER;
        ctx.globalAlpha = d.a;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function tick() {
      ctx.clearRect(0, 0, width, height);
      for (const d of dots) {
        d.y -= d.vy;
        d.x += d.vx;
        if (d.y < -5) {
          d.y = height + 5;
          d.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = AMBER;
        ctx.globalAlpha = d.a;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener('resize', resize);

    if (reduce) {
      drawStatic();
    } else {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="intro-particles" />;
}
