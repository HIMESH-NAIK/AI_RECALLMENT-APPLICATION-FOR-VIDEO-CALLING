import React, { useEffect, useRef } from 'react';

// A very subtle cursor-following glow using a single absolutely positioned div
// that follows pointer events. Respects prefers-reduced-motion.
export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return; // disable glow for reduced motion

    const el = glowRef.current;
    if (!el) return;

    let raf = 0;
    let mouseX = -9999;
    let mouseY = -9999;
    let lastX = -9999;
    let lastY = -9999;

    function onMove(e: PointerEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }

    function update() {
      lastX += (mouseX - lastX) * 0.12;
      lastY += (mouseY - lastY) * 0.12;
      if (el) {
        el.style.transform = `translate3d(${lastX - 120}px, ${lastY - 120}px, 0)`;
      }
      raf = requestAnimationFrame(update);
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden
      className="pointer-events-none fixed z-[60] top-0 left-0 w-[240px] h-[240px] rounded-full opacity-60 blur-3xl transition-opacity duration-300"
      style={{
        background: 'radial-gradient(circle at 30% 30%, rgba(99,102,241,0.12), rgba(99,102,241,0.06) 30%, rgba(99,102,241,0) 70%)',
        mixBlendMode: 'screen',
      }}
    />
  );
}
