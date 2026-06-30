"use client";

import React, { useEffect, useRef, useState } from "react";

// Gear specification interface
interface GearSpec {
  id: string;
  x?: number;             // Proportional x (0 to 1) if absolute, or absolute pixel offset if root
  y?: number;             // Proportional y (0 to 1) if absolute
  outerRadius: number;   // In pixels
  teeth: number;
  direction: number;     // 1 for CW, -1 for CCW
  speedMultiplier: number;
  parentId?: string;     // Interlocks with parent
  parentAngle?: number;  // Angle (in radians) from parent center to this gear center
  label: string;
  showDetails?: boolean;
}

// Schematic node interface for orthogonal circuit traces
interface SchematicNode {
  x: number;
  y: number;
  connectedTo: number[]; // Indices of other nodes this node connects to
}

// Flowing pulse on schematic tracks
interface TracePulse {
  fromNode: number;
  toNode: number;
  progress: number;
  speed: number;
}

export const MechanicalBlueprint: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fpsRef = useRef(60);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let baseAngle = 0; // Master rotation angle
    let frameCount = 0;
    let lastTime = performance.now();

    // Mouse telemetry tracking
    const mouse = { x: -1000, y: -1000, active: false };

    // Setup Schematic Circuit Nodes
    let nodes: SchematicNode[] = [];
    let pulses: TracePulse[] = [];

    const initSchematic = (w: number, h: number) => {
      nodes = [];
      pulses = [];

      // Create orthogonal circuit layouts on the left and right sides
      // Left side circuit
      const leftCol1 = w * 0.08;
      const leftCol2 = w * 0.18;
      const leftCol3 = w * 0.28;
      
      nodes.push({ x: leftCol1, y: h * 0.2, connectedTo: [1] });
      nodes.push({ x: leftCol2, y: h * 0.2, connectedTo: [2, 3] });
      nodes.push({ x: leftCol2, y: h * 0.5, connectedTo: [4] });
      nodes.push({ x: leftCol3, y: h * 0.3, connectedTo: [5] });
      nodes.push({ x: leftCol1, y: h * 0.5, connectedTo: [] });
      nodes.push({ x: leftCol3, y: h * 0.6, connectedTo: [6] });
      nodes.push({ x: leftCol2, y: h * 0.6, connectedTo: [4] }); // connects to leftCol1, y: 0.5

      // Right side circuit
      const rightCol1 = w * 0.92;
      const rightCol2 = w * 0.82;
      const rightCol3 = w * 0.72;

      nodes.push({ x: rightCol1, y: h * 0.7, connectedTo: [8] });
      nodes.push({ x: rightCol2, y: h * 0.7, connectedTo: [9, 10] });
      nodes.push({ x: rightCol2, y: h * 0.4, connectedTo: [11] });
      nodes.push({ x: rightCol3, y: h * 0.6, connectedTo: [12] });
      nodes.push({ x: rightCol1, y: h * 0.4, connectedTo: [] });
      nodes.push({ x: rightCol3, y: h * 0.3, connectedTo: [13] });
      nodes.push({ x: rightCol2, y: h * 0.3, connectedTo: [11] });

      // Add cross connections
      nodes.push({ x: w * 0.15, y: h * 0.85, connectedTo: [15] });
      nodes.push({ x: w * 0.35, y: h * 0.85, connectedTo: [] });

      nodes.push({ x: w * 0.85, y: h * 0.85, connectedTo: [17] });
      nodes.push({ x: w * 0.65, y: h * 0.85, connectedTo: [] });

      // Initialize a few pulses
      for (let i = 0; i < 8; i++) {
        spawnPulse();
      }
    };

    const spawnPulse = () => {
      if (nodes.length === 0) return;
      // Pick a random node that has connections
      const candidates = nodes
        .map((node, index) => ({ node, index }))
        .filter(item => item.node.connectedTo.length > 0);

      if (candidates.length === 0) return;
      const randomStart = candidates[Math.floor(Math.random() * candidates.length)];
      const targetIndex = randomStart.node.connectedTo[Math.floor(Math.random() * randomStart.node.connectedTo.length)];
      
      pulses.push({
        fromNode: randomStart.index,
        toNode: targetIndex,
        progress: 0,
        speed: 0.005 + Math.random() * 0.008
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Re-initialize layouts
      initSchematic(width, height);
    };

    // Calculate gear properties recursively for interlocking
    const resolveGears = (specs: GearSpec[]): Array<GearSpec & { absX: number; absY: number; resolvedAngle: number }> => {
      const resolvedMap = new Map<string, GearSpec & { absX: number; absY: number; resolvedAngle: number }>();
      
      // Separate root gears (no parent) and child gears
      const roots = specs.filter(s => !s.parentId);
      const children = specs.filter(s => s.parentId);

      // Process root gears first
      roots.forEach(gear => {
        // Root coordinates are proportional to screen size if x, y <= 1, else treated as pixels
        const gx = gear.x ?? 0;
        const gy = gear.y ?? 0;
        const absX = gx <= 1 ? width * gx : gx;
        const absY = gy <= 1 ? height * gy : gy;
        
        resolvedMap.set(gear.id, {
          ...gear,
          absX,
          absY,
          resolvedAngle: baseAngle * gear.direction * gear.speedMultiplier
        });
      });

      // Iteratively resolve children (up to 5 passes to handle nesting)
      for (let pass = 0; pass < 5; pass++) {
        children.forEach(gear => {
          if (resolvedMap.has(gear.id)) return; // Already resolved
          if (!gear.parentId) return;

          const parent = resolvedMap.get(gear.parentId);
          if (!parent) return; // Parent not resolved yet

          // Parent's pitch radius and child's pitch radius
          const rParent = parent.outerRadius * 0.9;
          const rChild = gear.outerRadius * 0.9;
          const centerDist = rParent + rChild;

          // Compute absolute position based on parent angle
          const angleToChild = gear.parentAngle || 0;
          const absX = parent.absX + centerDist * Math.cos(angleToChild);
          const absY = parent.absY + centerDist * Math.sin(angleToChild);

          // Perfect gear meshing angle formula:
          // theta_child = - (N_parent / N_child) * theta_parent + (1 + N_parent / N_child) * phi + PI - PI / N_child
          const ratio = parent.teeth / gear.teeth;
          const resolvedAngle = -ratio * parent.resolvedAngle + (1 + ratio) * angleToChild + Math.PI - Math.PI / gear.teeth;

          resolvedMap.set(gear.id, {
            ...gear,
            absX,
            absY,
            resolvedAngle
          });
        });
      }

      return Array.from(resolvedMap.values());
    };

    // Draw a mathematically accurate spur gear
    const drawGear = (
      absX: number,
      absY: number,
      outerRadius: number,
      teeth: number,
      angle: number,
      label: string,
      showDetails: boolean,
      isDark: boolean
    ) => {
      const pitchRadius = outerRadius * 0.9;
      const rootRadius = outerRadius * 0.8;
      const rimRadius = outerRadius * 0.73;
      const hubRadius = outerRadius * 0.25;
      const shaftRadius = outerRadius * 0.12;

      const mainColor = isDark ? "rgba(56, 189, 248, 0.12)" : "rgba(37, 99, 235, 0.08)";
      const accentColor = isDark ? "rgba(56, 189, 248, 0.45)" : "rgba(37, 99, 235, 0.3)";
      const fillColor = isDark ? "rgba(30, 41, 59, 0.08)" : "rgba(241, 245, 249, 0.1)";

      ctx.save();
      ctx.translate(absX, absY);

      // 1. Draw gear fill
      ctx.beginPath();
      for (let i = 0; i < teeth; i++) {
        const toothAngle = angle + (i * 2 * Math.PI) / teeth;
        const w = Math.PI / (2 * teeth); // half pitch width
        const wTip = Math.PI / (4.2 * teeth); // tooth tip width

        const a1 = toothAngle - w;
        const a2 = toothAngle - wTip;
        const a3 = toothAngle + wTip;
        const a4 = toothAngle + w;

        if (i === 0) {
          ctx.moveTo(rootRadius * Math.cos(a1), rootRadius * Math.sin(a1));
        } else {
          ctx.lineTo(rootRadius * Math.cos(a1), rootRadius * Math.sin(a1));
        }
        ctx.lineTo(outerRadius * Math.cos(a2), outerRadius * Math.sin(a2));
        ctx.lineTo(outerRadius * Math.cos(a3), outerRadius * Math.sin(a3));
        ctx.lineTo(rootRadius * Math.cos(a4), rootRadius * Math.sin(a4));
        
        // Arc along root circle to next tooth start
        const nextToothAngle = angle + ((i + 1) * 2 * Math.PI) / teeth;
        const nextA1 = nextToothAngle - w;
        ctx.arc(0, 0, rootRadius, a4, nextA1, false);
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      // 2. Draw gear outline (stroke)
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // 3. Draw inner details (rim, spokes, hub)
      ctx.beginPath();
      ctx.arc(0, 0, rimRadius, 0, 2 * Math.PI);
      ctx.stroke();

      // Hub
      ctx.beginPath();
      ctx.arc(0, 0, hubRadius, 0, 2 * Math.PI);
      ctx.stroke();

      // Spokes (5 spokes)
      ctx.beginPath();
      for (let s = 0; s < 5; s++) {
        const spokeAngle = angle + (s * 2 * Math.PI) / 5;
        ctx.moveTo(hubRadius * Math.cos(spokeAngle), hubRadius * Math.sin(spokeAngle));
        ctx.lineTo(rimRadius * Math.cos(spokeAngle), rimRadius * Math.sin(spokeAngle));
      }
      ctx.stroke();

      // Shaft with keyway key
      ctx.beginPath();
      const kwW = shaftRadius * 0.4; // Keyway width
      const kwH = shaftRadius * 0.3; // Keyway depth
      
      // Draw circular shaft except top keyway
      const kwAngleStart = -Math.asin(kwW / (2 * shaftRadius));
      const kwAngleEnd = Math.asin(kwW / (2 * shaftRadius));
      
      ctx.arc(0, 0, shaftRadius, kwAngleEnd, 2 * Math.PI + kwAngleStart, false);
      // Keyway notch box
      ctx.lineTo(shaftRadius * Math.cos(kwAngleStart), -kwW / 2);
      ctx.lineTo(shaftRadius + kwH, -kwW / 2);
      ctx.lineTo(shaftRadius + kwH, kwW / 2);
      ctx.lineTo(shaftRadius * Math.cos(kwAngleEnd), kwW / 2);
      ctx.closePath();
      ctx.stroke();

      // 4. Draw pitch circle (dashed reference line)
      ctx.beginPath();
      ctx.arc(0, 0, pitchRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.08)" : "rgba(37, 99, 235, 0.04)";
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]); // Reset

      // 5. Draw technical overlays if showDetails is active
      if (showDetails) {
        // Outer radius reference circle (dotted, cyan)
        ctx.beginPath();
        ctx.arc(0, 0, outerRadius + 8, 0, 2 * Math.PI);
        ctx.strokeStyle = isDark ? "rgba(6, 182, 212, 0.15)" : "rgba(13, 148, 136, 0.1)";
        ctx.setLineDash([1, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Diameter dimension callout
        ctx.beginPath();
        const dimAngle = -Math.PI / 4;
        ctx.moveTo(0, 0);
        ctx.lineTo((outerRadius + 25) * Math.cos(dimAngle), (outerRadius + 25) * Math.sin(dimAngle));
        ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.15)" : "rgba(37, 99, 235, 0.1)";
        ctx.stroke();

        // Horizontal tail for dimension label
        const tailX = (outerRadius + 25) * Math.cos(dimAngle);
        const tailY = (outerRadius + 25) * Math.sin(dimAngle);
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(tailX + 45, tailY);
        ctx.stroke();

        // Text
        ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.45)" : "rgba(100, 116, 139, 0.5)";
        ctx.font = "8px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`Ø ${Math.round(outerRadius * 2)}px`, tailX + 4, tailY - 2);

        // RPM/System status tags
        ctx.textBaseline = "top";
        ctx.fillStyle = accentColor;
        ctx.fillText(`${label}`, 12, rimRadius + 12);
        
        // Rotating orientation alignment notch helper
        ctx.beginPath();
        ctx.arc(rimRadius * Math.cos(angle), rimRadius * Math.sin(angle), 2, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? "rgba(34, 211, 238, 0.7)" : "rgba(13, 148, 136, 0.6)";
        ctx.fill();
      }

      ctx.restore();
    };

    // Draw orthogonal grids and peripheral HUD frames
    const drawHUD = (isDark: boolean) => {
      const gridColor = isDark ? "rgba(56, 189, 248, 0.025)" : "rgba(37, 99, 235, 0.015)";
      const majorGridColor = isDark ? "rgba(56, 189, 248, 0.05)" : "rgba(37, 99, 235, 0.03)";
      
      const gridSpacing = 64;

      // Draw faint background grid
      ctx.lineWidth = 0.5;
      
      // Vertical grid lines
      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.strokeStyle = x % (gridSpacing * 4) === 0 ? majorGridColor : gridColor;
        ctx.stroke();

        // Top margin tick labels
        if (x % (gridSpacing * 4) === 0 && x > 0 && x < width - 100) {
          ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.25)" : "rgba(100, 116, 139, 0.3)";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`X.${String(x).padStart(4, "0")}`, x, 12);
        }
      }

      // Horizontal grid lines
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.strokeStyle = y % (gridSpacing * 4) === 0 ? majorGridColor : gridColor;
        ctx.stroke();

        // Left margin tick labels
        if (y % (gridSpacing * 4) === 0 && y > 0 && y < height - 50) {
          ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.25)" : "rgba(100, 116, 139, 0.3)";
          ctx.font = "8px monospace";
          ctx.textAlign = "left";
          ctx.fillText(`Y.${String(y).padStart(4, "0")}`, 8, y + 3);
        }
      }

      // Radar Concentric HUD in top-right corner
      const hudCX = width * 0.9;
      const hudCY = height * 0.15;
      const hudR = 90;
      
      ctx.save();
      ctx.translate(hudCX, hudCY);
      
      // Circles
      ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.08)" : "rgba(37, 99, 235, 0.05)";
      ctx.lineWidth = 0.8;
      
      ctx.beginPath();
      ctx.arc(0, 0, hudR, 0, 2 * Math.PI);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(0, 0, hudR * 0.6, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, hudR * 0.3, 0, 2 * Math.PI);
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.setLineDash([]);

      // crosshairs
      ctx.beginPath();
      ctx.moveTo(-hudR - 10, 0);
      ctx.lineTo(hudR + 10, 0);
      ctx.moveTo(0, -hudR - 10);
      ctx.lineTo(0, hudR + 10);
      ctx.stroke();

      // Radar rotating sweep wedge
      const sweepAngle = (baseAngle * 1.5) % (Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, hudR, sweepAngle - 0.25, sweepAngle, false);
      ctx.closePath();
      
      const sweepGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, hudR);
      sweepGrad.addColorStop(0, isDark ? "rgba(6, 182, 212, 0.1)" : "rgba(13, 148, 136, 0.06)");
      sweepGrad.addColorStop(1, isDark ? "rgba(6, 182, 212, 0.0)" : "rgba(13, 148, 136, 0.0)");
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // Sweep leading line
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(hudR * Math.cos(sweepAngle), hudR * Math.sin(sweepAngle));
      ctx.strokeStyle = isDark ? "rgba(6, 182, 212, 0.25)" : "rgba(13, 148, 136, 0.2)";
      ctx.stroke();

      // HUD annotations
      ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(100, 116, 139, 0.4)";
      ctx.font = "7px monospace";
      ctx.textAlign = "center";
      ctx.fillText("SYS.RADAR.SCAN // R: 1800m", 0, -hudR - 14);
      ctx.fillText(`AZ: ${(sweepAngle * (180 / Math.PI)).toFixed(1)}°`, 0, hudR + 14);

      // Blinking radar target
      const blink = Math.sin(frameCount * 0.1) > 0.3;
      if (blink) {
        ctx.beginPath();
        ctx.arc(hudR * 0.5, -hudR * 0.3, 3, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? "rgba(34, 211, 238, 0.8)" : "rgba(13, 148, 136, 0.7)";
        ctx.fill();
        ctx.fillText("TRGT_01", hudR * 0.5, -hudR * 0.3 - 6);
      }

      ctx.restore();
    };

    // Draw the orthogonal schematic traces and moving pulses
    const drawSchematic = (isDark: boolean) => {
      ctx.save();
      
      // Draw wires
      ctx.strokeStyle = isDark ? "rgba(6, 182, 212, 0.07)" : "rgba(13, 148, 136, 0.05)";
      ctx.lineWidth = 1.0;
      
      nodes.forEach((node) => {
        node.connectedTo.forEach((targetIdx) => {
          const target = nodes[targetIdx];
          if (!target) return;
          
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          // Standard blueprint circuit visual: draw layout lines with tiny connection dots
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        });

        // Draw node nodes (circles)
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? "rgba(6, 182, 212, 0.2)" : "rgba(13, 148, 136, 0.15)";
        ctx.fill();
      });

      // Update and draw pulses
      pulses.forEach((pulse, index) => {
        const fromNode = nodes[pulse.fromNode];
        const toNode = nodes[pulse.toNode];
        
        if (!fromNode || !toNode) return;

        // Linear interpolation
        const currentX = fromNode.x + (toNode.x - fromNode.x) * pulse.progress;
        const currentY = fromNode.y + (toNode.y - fromNode.y) * pulse.progress;

        // Draw glowing point
        ctx.beginPath();
        ctx.arc(currentX, currentY, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? "rgba(34, 211, 238, 0.7)" : "rgba(13, 148, 136, 0.6)";
        ctx.shadowColor = isDark ? "rgba(34, 211, 238, 0.9)" : "rgba(13, 148, 136, 0.7)";
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow

        // Progress pulse
        pulse.progress += pulse.speed;

        // Recycle pulse
        if (pulse.progress >= 1.0) {
          // Find next connection from target node
          const nextTargets = toNode.connectedTo;
          if (nextTargets.length > 0) {
            pulse.fromNode = pulse.toNode;
            pulse.toNode = nextTargets[Math.floor(Math.random() * nextTargets.length)];
            pulse.progress = 0;
          } else {
            // Re-spawn entirely
            const candidates = nodes
              .map((node, index) => ({ node, index }))
              .filter(item => item.node.connectedTo.length > 0);
            
            if (candidates.length > 0) {
              const randomStart = candidates[Math.floor(Math.random() * candidates.length)];
              pulse.fromNode = randomStart.index;
              pulse.toNode = randomStart.node.connectedTo[Math.floor(Math.random() * randomStart.node.connectedTo.length)];
              pulse.progress = 0;
            }
          }
        }
      });

      ctx.restore();
    };

    // Draw updating technical texts (telemetry console logs) in bottom corners
    const drawTelemetry = (isDark: boolean) => {
      ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.3)" : "rgba(100, 116, 139, 0.35)";
      ctx.font = "8px monospace";
      ctx.textAlign = "left";

      const lineH = 12;
      const leftColX = 16;
      const rightColX = width - 180;
      const bottomY = height - 16;

      // Bottom Left Telemetry Panel
      const systemClock = new Date().toISOString().slice(11, 19);
      const metricsL = [
        `SYSTEM: MEO_SECURE_AUTH // CLK: ${systemClock}`,
        `CORE.INTEGRITY: 99.87% // TEMP: ${(38.2 + Math.sin(frameCount * 0.01) * 0.4).toFixed(1)}°C`,
        `DB.REF: PG_SUPABASE // POOL_STATE: IDLE`,
        `SYS.LINK: ACTIVE // LATENCY: 22ms`
      ];

      metricsL.forEach((metric, idx) => {
        ctx.fillText(metric, leftColX, bottomY - (metricsL.length - 1 - idx) * lineH);
      });

      // Bottom Right Telemetry Panel
      const metricsR = [
        `ENCRYPTION: AES_256_GCM // SHIELD: ON`,
        `PORTAL.STATE: ESTABLISHING_HANDSHAKE`,
        `TELEMETRY_LOGS: ACTIVE // PIPE_OK`,
        `FRAME.RENDER: CANVAS2D // FPS: ${fpsRef.current}`
      ];

      metricsR.forEach((metric, idx) => {
        ctx.fillText(metric, rightColX, bottomY - (metricsR.length - 1 - idx) * lineH);
      });
    };

    // Blueprint Gear Config definition
    // Note how we configure System A, System B, and the Massive background Gear meshed together
    const getGearsConfig = (): GearSpec[] => {
      return [
        // Root Gear A (Large, bottom left)
        {
          id: "gear-a1",
          x: 0.15,
          y: 0.65,
          outerRadius: 130,
          teeth: 20,
          direction: 1,
          speedMultiplier: 0.6,
          label: "GEAR_DRIVE_01",
          showDetails: true
        },
        // Gear A2 (interlocking with A1, placed top-right of it)
        {
          id: "gear-a2",
          parentId: "gear-a1",
          parentAngle: -Math.PI / 6, // 30 degrees upwards
          outerRadius: 75,
          teeth: 12,
          direction: -1,
          speedMultiplier: 0.6, // Speeds are calculated relative to master baseAngle and ratio
          label: "GEAR_SEC_02",
          showDetails: true
        },
        // Root Gear B (Medium, top-right of center)
        {
          id: "gear-b1",
          x: 0.82,
          y: 0.28,
          outerRadius: 100,
          teeth: 16,
          direction: -1,
          speedMultiplier: 0.8,
          label: "GEAR_DRIVE_02",
          showDetails: true
        },
        // Gear B2 (interlocking with B1, placed below-left of it)
        {
          id: "gear-b2",
          parentId: "gear-b1",
          parentAngle: Math.PI * 0.75, // down-left
          outerRadius: 55,
          teeth: 8,
          direction: 1,
          speedMultiplier: 0.8,
          label: "GEAR_SUB_03",
          showDetails: true
        },
        // MASSIVE central faint gear (behind login form)
        {
          id: "gear-massive",
          x: 0.5,
          y: 0.5,
          outerRadius: 280,
          teeth: 48,
          direction: 1,
          speedMultiplier: 0.15, // Extremely slow rotation
          label: "CORE_MATRIX_DRIVE // SYSTEM_PRIMARY",
          showDetails: true
        }
      ];
    };

    // Main animation loop
    const draw = (timestamp: number) => {
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      // FPS tracking
      frameCount++;
      if (timestamp - lastTime >= 1000) {
        fpsRef.current = Math.round((frameCount * 1000) / (timestamp - lastTime));
        frameCount = 0;
        lastTime = timestamp;
      }

      ctx.clearRect(0, 0, width, height);

      // Detect current theme (dark vs light)
      const isDark = document.documentElement.classList.contains("dark");

      // Adaptive Background color
      ctx.fillStyle = isDark ? "#020617" : "#f8fafc";
      ctx.fillRect(0, 0, width, height);

      // Increment master angle rotation (slow and smooth)
      baseAngle += 0.0035;

      // 1. Draw static grid and circular HUD overlays
      drawHUD(isDark);

      // 2. Draw orthogonal blueprint circuit lines
      drawSchematic(isDark);

      // 3. Resolve interlocking positions and angles, then draw gears
      const gearsConfig = getGearsConfig();
      const resolved = resolveGears(gearsConfig);

      // Draw massive background gear first so it sits behind active foreground gears
      const massiveIdx = resolved.findIndex(g => g.id === "gear-massive");
      if (massiveIdx !== -1) {
        const mg = resolved[massiveIdx];
        drawGear(mg.absX, mg.absY, mg.outerRadius, mg.teeth, mg.resolvedAngle, mg.label, true, isDark);
      }

      // Draw other gears
      resolved.forEach((gear) => {
        if (gear.id === "gear-massive") return;
        drawGear(gear.absX, gear.absY, gear.outerRadius, gear.teeth, gear.resolvedAngle, gear.label, gear.showDetails || false, isDark);
      });

      // 4. Draw diagnostic console telemetry log text
      drawTelemetry(isDark);

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
      mouse.active = false;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    // Initial setup
    resize();
    animationFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0 pointer-events-none" />;
};
