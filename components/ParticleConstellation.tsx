"use client";

import React, { useEffect, useRef } from "react";

interface Particle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
}

export const ParticleConstellation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle3D[] = [];
    let width = 0;
    let height = 0;
    const depth = 600;
    const fov = 450; // Focal length for 3D perspective
    
    let frameCount = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    const mouse = { x: -1000, y: -1000, radius: 150 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Fill canvas background to avoid brief flickers
      const isDark = document.documentElement.classList.contains("dark");
      ctx.fillStyle = isDark ? "#020617" : "#f8fafc";
      ctx.fillRect(0, 0, width, height);

      initParticles();
    };

    const initParticles = () => {
      const area = width * height;
      const count = Math.min(100, Math.floor(area / 14000));
      
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: (Math.random() - 0.5) * width,
          y: (Math.random() - 0.5) * height,
          z: (Math.random() - 0.5) * depth,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          vz: (Math.random() - 0.5) * 0.35,
          radius: Math.random() * 1.6 + 0.8,
        });
      }
    };

    const draw = () => {
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains("dark");

      // Adaptive Background base
      ctx.fillStyle = isDark ? "#020617" : "#f8fafc"; 
      ctx.fillRect(0, 0, width, height);

      frameCount++;

      // Slow passive rotations
      const angleY = 0.0003;
      const angleX = 0.00015;

      // Mouse interactive tilt/rotation influence
      const targetRotY = mouse.x !== -1000 ? (mouse.x - width / 2) * 0.00015 : 0;
      const targetRotX = mouse.y !== -1000 ? -(mouse.y - height / 2) * 0.00015 : 0;
      currentRotY += (targetRotY - currentRotY) * 0.05;
      currentRotX += (targetRotX - currentRotX) * 0.05;

      const totalAngleY = frameCount * angleY + currentRotY;
      const totalAngleX = frameCount * angleX + currentRotX;

      const cosY = Math.cos(totalAngleY);
      const sinY = Math.sin(totalAngleY);
      const cosX = Math.cos(totalAngleX);
      const sinX = Math.sin(totalAngleX);

      // Project particles to 2D screen coordinates
      const projected = particles.map(p => {
        // Move particle in its 3D local coordinate box
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Bounce boundaries
        const wHalf = width / 2;
        const hHalf = height / 2;
        const dHalf = depth / 2;
        if (p.x < -wHalf || p.x > wHalf) p.vx *= -1;
        if (p.y < -hHalf || p.y > hHalf) p.vy *= -1;
        if (p.z < -dHalf || p.z > dHalf) p.vz *= -1;

        // Mouse gravity influence in 3D space
        if (mouse.x !== -1000) {
          const mx = mouse.x - width / 2;
          const my = mouse.y - height / 2;
          const dx = p.x - mx;
          const dy = p.y - my;
          const dz = p.z - 0; // z=0 plane where mouse operates
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            // Gently warp particles in mouse direction
            p.x += (dx / dist) * force * 0.5;
            p.y += (dy / dist) * force * 0.5;
            p.z += (dz / dist) * force * 0.5;
          }
        }

        // Apply 3D coordinate rotation
        // Y rotation
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.z * cosY + p.x * sinY;
        // X rotation
        const y1 = p.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + p.y * sinX;

        // Perspective scale factor
        const scale = fov / (fov + z2);
        
        // Projected 2D coordinates relative to center
        const px = x1 * scale + width / 2;
        const py = y1 * scale + height / 2;

        // Relative depth alpha: z2 can range from -dHalf to +dHalf
        // Map z2 from front (-300) to back (+300) -> alpha from 1.0 down to 0.15
        const depthAlpha = Math.max(0.15, Math.min(1.0, (fov - z2) / fov));

        return {
          px,
          py,
          pz: z2,
          radius: p.radius * scale,
          depthAlpha
        };
      });

      const maxDistance = 140;

      // Draw connection lines between nodes in 3D
      for (let i = 0; i < projected.length; i++) {
        const p1 = particles[i];
        const pr1 = projected[i];

        for (let j = i + 1; j < projected.length; j++) {
          const p2 = particles[j];
          const pr2 = projected[j];

          // Determine distance in 3D space
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dz = p1.z - p2.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < maxDistance * maxDistance) {
            const dist = Math.sqrt(distSq);
            // Opacity fades both with distance and depth of field
            const opacity = (1 - dist / maxDistance) * Math.min(pr1.depthAlpha, pr2.depthAlpha);

            ctx.strokeStyle = isDark 
              ? `rgba(59, 130, 246, ${opacity * 0.18})` 
              : `rgba(37, 99, 235, ${opacity * 0.14})`;
            ctx.lineWidth = 0.65;
            ctx.beginPath();
            ctx.moveTo(pr1.px, pr1.py);
            ctx.lineTo(pr2.px, pr2.py);
            ctx.stroke();
          }
        }

        // Connect particles to mouse cursor if near in 3D
        if (mouse.x !== -1000) {
          const mx = mouse.x - width / 2;
          const my = mouse.y - height / 2;
          const dx = p1.x - mx;
          const dy = p1.y - my;
          const dz = p1.z - 0;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < mouse.radius * mouse.radius) {
            const dist = Math.sqrt(distSq);
            const opacity = (1 - dist / mouse.radius) * pr1.depthAlpha;
            ctx.strokeStyle = isDark 
              ? `rgba(59, 130, 246, ${opacity * 0.15})` 
              : `rgba(37, 99, 235, ${opacity * 0.11})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(pr1.px, pr1.py);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      // Draw projected particles
      for (let i = 0; i < projected.length; i++) {
        const pr = projected[i];
        const alpha = isDark ? pr.depthAlpha * 0.55 : pr.depthAlpha * 0.4;
        
        ctx.fillStyle = isDark 
          ? `rgba(59, 130, 246, ${alpha})` 
          : `rgba(37, 99, 235, ${alpha})`;
        
        ctx.beginPath();
        ctx.arc(pr.px, pr.py, Math.max(0.4, pr.radius), 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    resize();
    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0" />;
};
