import React from 'react';
import { ParticleConstellation } from './ParticleConstellation';
import { MechanicalBlueprint } from './MechanicalBlueprint';

interface DashboardBackgroundProps {
  bgStyle: 'particles' | 'blueprint' | 'none';
}

export const DashboardBackground = React.memo(({ bgStyle }: DashboardBackgroundProps) => {
  return (
    <>
      {/* Background Particle Constellation / Mechanical Blueprint */}
      {bgStyle === 'particles' && <ParticleConstellation />}
      {bgStyle === 'blueprint' && <MechanicalBlueprint />}

      {/* Cyber Grid Subtle Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-accent)_4%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-accent)_4%,transparent)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0 opacity-40 dark:opacity-25" />

      {/* Glowing Glassmorphic Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Blob 1: Pink/magenta blob in top-left/center area */}
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-pink-500/10 dark:bg-pink-600/5 blur-[120px] animate-blob-slow mix-blend-multiply dark:mix-blend-screen" />
        {/* Blob 2: Blue/cyan blob in bottom-right/center area */}
        <div className="absolute bottom-[10%] right-[20%] w-[500px] h-[500px] rounded-full bg-blue-500/10 dark:bg-cyan-600/5 blur-[120px] animate-blob-reverse mix-blend-multiply dark:mix-blend-screen" />
        {/* Blob 3: Purple/violet blob in middle-left area */}
        <div className="absolute top-[40%] left-[5%] w-[400px] h-[400px] rounded-full bg-purple-500/8 dark:bg-violet-600/5 blur-[120px] animate-blob-slow-alt mix-blend-multiply dark:mix-blend-screen" />
      </div>
    </>
  );
});

DashboardBackground.displayName = 'DashboardBackground';
