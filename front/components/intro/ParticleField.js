'use client';

import { useEffect, useRef } from 'react';

/**
 * Poeira dourada flutuando na escuridão da abertura. Canvas leve, com
 * devicePixelRatio limitado e render estático quando o usuário prefere
 * movimento reduzido. Portado do protótipo de front (abertura cinematográfica)
 * para o padrão JS/CSS deste projeto — sem dependências novas.
 */
export default function ParticleField({ intensity = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let raf = 0;
    let particles = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const amber = '#E8A84A';

    function spawn() {
      const z = Math.random() * 0.8 + 0.2;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        r: z * 1.8 + 0.3,
        vx: (Math.random() - 0.5) * 0.15 * z,
        vy: (Math.random() - 0.5) * 0.15 * z - 0.05,
        a: Math.random() * 0.5 + 0.1,
      };
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((Math.min(width, 900) / 900) * 70 * intensity);
      particles = Array.from({ length: count }, spawn);
    }

    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = amber;
        ctx.globalAlpha = p.a * p.z;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function tick() {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = amber;
        ctx.globalAlpha = p.a * p.z;
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
  }, [intensity]);

  return <canvas ref={canvasRef} aria-hidden="true" className="intro-particles" />;
}
