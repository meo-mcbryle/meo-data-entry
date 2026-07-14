"use client";

import React, { useEffect, useRef } from "react";

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

    // 3D rotation variables
    let currentYaw = 0;
    let currentPitch = 0;

    // Mouse telemetry tracking
    const mouse = { x: -1000, y: -1000, active: false };

    // Project 2D coordinates into 3D rotating coordinate space
    const project3D = (x: number, y: number, z: number = 0) => {
      const cosY = Math.cos(currentYaw);
      const sinY = Math.sin(currentYaw);
      const cosX = Math.cos(currentPitch);
      const sinX = Math.sin(currentPitch);

      // Shift coordinate system so screen center is at (0, 0)
      const cx = x - width / 2;
      const cy = y - height / 2;

      // Rotate around Y axis (Yaw)
      const x1 = cx * cosY - z * sinY;
      const z1 = z * cosY + cx * sinY;

      // Rotate around X axis (Pitch)
      const y1 = cy * cosX - z1 * sinX;
      const z2 = z1 * cosX + cy * sinX;

      // Perspective scale factor
      const fov = 850;
      const scale = fov / (fov + z2);

      return {
        x: x1 * scale + width / 2,
        y: y1 * scale + height / 2,
        scale
      };
    };

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

    // Draw a mathematically accurate spur gear in 3D
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
      const thickness = 12; // Cylinder thickness in Z direction

      // Helper to generate coordinates for a gear face at a specific Z coordinate
      const getGearFacePoints = (zVal: number) => {
        const pts: Array<{ x: number; y: number; z: number }> = [];
        for (let i = 0; i < teeth; i++) {
          const toothAngle = angle + (i * 2 * Math.PI) / teeth;
          const w = Math.PI / (2 * teeth);
          const wTip = Math.PI / (4.2 * teeth);

          const a1 = toothAngle - w;
          const a2 = toothAngle - wTip;
          const a3 = toothAngle + wTip;
          const a4 = toothAngle + w;

          pts.push({ x: absX + rootRadius * Math.cos(a1), y: absY + rootRadius * Math.sin(a1), z: zVal });
          pts.push({ x: absX + outerRadius * Math.cos(a2), y: absY + outerRadius * Math.sin(a2), z: zVal });
          pts.push({ x: absX + outerRadius * Math.cos(a3), y: absY + outerRadius * Math.sin(a3), z: zVal });
          pts.push({ x: absX + rootRadius * Math.cos(a4), y: absY + rootRadius * Math.sin(a4), z: zVal });
        }
        return pts;
      };

      const frontFace = getGearFacePoints(thickness);
      const backFace = getGearFacePoints(-thickness);

      const frontProj = frontFace.map(p => project3D(p.x, p.y, p.z));
      const backProj = backFace.map(p => project3D(p.x, p.y, p.z));

      // 1. Fill front face
      ctx.beginPath();
      if (frontProj.length > 0) {
        ctx.moveTo(frontProj[0].x, frontProj[0].y);
        for (let i = 1; i < frontProj.length; i++) {
          ctx.lineTo(frontProj[i].x, frontProj[i].y);
        }
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      // 2. Outline front and back faces
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1.0;

      ctx.beginPath();
      if (frontProj.length > 0) {
        ctx.moveTo(frontProj[0].x, frontProj[0].y);
        for (let i = 1; i < frontProj.length; i++) {
          ctx.lineTo(frontProj[i].x, frontProj[i].y);
        }
      }
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      if (backProj.length > 0) {
        ctx.moveTo(backProj[0].x, backProj[0].y);
        for (let i = 1; i < backProj.length; i++) {
          ctx.lineTo(backProj[i].x, backProj[i].y);
        }
      }
      ctx.closePath();
      ctx.stroke();

      // 3. Connect corresponding teeth vertices (extrusion lines)
      ctx.beginPath();
      for (let i = 0; i < frontProj.length; i++) {
        ctx.moveTo(frontProj[i].x, frontProj[i].y);
        ctx.lineTo(backProj[i].x, backProj[i].y);
      }
      ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.06)" : "rgba(37, 99, 235, 0.04)";
      ctx.stroke();

      // Restore main gear outline color
      ctx.strokeStyle = mainColor;

      // Helper to draw a projected circle at Z
      const drawProjectedCircle = (radius: number, zVal: number) => {
        ctx.beginPath();
        for (let i = 0; i <= 36; i++) {
          const theta = (i * 2 * Math.PI) / 36;
          const p = project3D(absX + radius * Math.cos(theta), absY + radius * Math.sin(theta), zVal);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      };

      // Draw inner details (rim, hub, shaft keyway, spokes) on front face
      drawProjectedCircle(rimRadius, thickness);
      drawProjectedCircle(hubRadius, thickness);

      // Spokes (5 spokes)
      ctx.beginPath();
      for (let s = 0; s < 5; s++) {
        const spokeAngle = angle + (s * 2 * Math.PI) / 5;
        const p1 = project3D(absX + hubRadius * Math.cos(spokeAngle), absY + hubRadius * Math.sin(spokeAngle), thickness);
        const p2 = project3D(absX + rimRadius * Math.cos(spokeAngle), absY + rimRadius * Math.sin(spokeAngle), thickness);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();

      // Shaft keyway notch
      const kwW = shaftRadius * 0.4;
      const kwH = shaftRadius * 0.3;
      const kwAngleStart = -Math.asin(kwW / (2 * shaftRadius));
      const kwAngleEnd = Math.asin(kwW / (2 * shaftRadius));

      const keywayPts: Array<{ x: number; y: number }> = [];
      const numSegs = 18;
      for (let i = 0; i <= numSegs; i++) {
        const theta = kwAngleEnd + ((2 * Math.PI + kwAngleStart - kwAngleEnd) * i) / numSegs;
        keywayPts.push({ x: shaftRadius * Math.cos(theta), y: shaftRadius * Math.sin(theta) });
      }
      keywayPts.push({ x: shaftRadius * Math.cos(kwAngleStart), y: -kwW / 2 });
      keywayPts.push({ x: shaftRadius + kwH, y: -kwW / 2 });
      keywayPts.push({ x: shaftRadius + kwH, y: kwW / 2 });
      keywayPts.push({ x: shaftRadius * Math.cos(kwAngleEnd), y: kwW / 2 });

      ctx.beginPath();
      keywayPts.forEach((pt, idx) => {
        const p = project3D(absX + pt.x, absY + pt.y, thickness);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();

      // Dotted pitch circle reference
      ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.08)" : "rgba(37, 99, 235, 0.04)";
      ctx.setLineDash([3, 4]);
      drawProjectedCircle(pitchRadius, thickness);
      ctx.setLineDash([]); // Reset

      if (showDetails && frontProj.length > 0) {
        const dimAngle = -Math.PI / 4;
        const pCenter = project3D(absX, absY, thickness);
        const pOuter = project3D(absX + (outerRadius + 25) * Math.cos(dimAngle), absY + (outerRadius + 25) * Math.sin(dimAngle), thickness);

        ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.15)" : "rgba(37, 99, 235, 0.1)";
        ctx.beginPath();
        ctx.moveTo(pCenter.x, pCenter.y);
        ctx.lineTo(pOuter.x, pOuter.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pOuter.x, pOuter.y);
        ctx.lineTo(pOuter.x + 45, pOuter.y);
        ctx.stroke();

        ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.45)" : "rgba(100, 116, 139, 0.5)";
        ctx.font = "8px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`Ø ${Math.round(outerRadius * 2)}px`, pOuter.x + 4, pOuter.y - 2);

        const pTag = project3D(absX + 12, absY + rimRadius + 12, thickness);
        ctx.textBaseline = "top";
        ctx.fillStyle = accentColor;
        ctx.fillText(`${label}`, pTag.x, pTag.y);

        const pNotch = project3D(absX + rimRadius * Math.cos(angle), absY + rimRadius * Math.sin(angle), thickness);
        ctx.beginPath();
        ctx.arc(pNotch.x, pNotch.y, 2 * pNotch.scale, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? "rgba(34, 211, 238, 0.7)" : "rgba(13, 148, 136, 0.6)";
        ctx.fill();
      }
    };

    // Draw orthogonal grids and peripheral HUD frames in 3D perspective
    const drawHUD = (isDark: boolean) => {
      const gridColor = isDark ? "rgba(56, 189, 248, 0.025)" : "rgba(37, 99, 235, 0.015)";
      const majorGridColor = isDark ? "rgba(56, 189, 248, 0.05)" : "rgba(37, 99, 235, 0.03)";
      
      const gridSpacing = 64;

      // Draw faint background grid
      ctx.lineWidth = 0.5;
      
      // Vertical grid lines projected
      for (let x = 0; x < width; x += gridSpacing) {
        const p1 = project3D(x, 0, 0);
        const p2 = project3D(x, height, 0);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = x % (gridSpacing * 4) === 0 ? majorGridColor : gridColor;
        ctx.stroke();

        // Top margin tick labels
        if (x % (gridSpacing * 4) === 0 && x > 0 && x < width - 100) {
          const pLabel = project3D(x, 12, 0);
          ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.25)" : "rgba(100, 116, 139, 0.3)";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`X.${String(x).padStart(4, "0")}`, pLabel.x, pLabel.y);
        }
      }

      // Horizontal grid lines projected
      for (let y = 0; y < height; y += gridSpacing) {
        const p1 = project3D(0, y, 0);
        const p2 = project3D(width, y, 0);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = y % (gridSpacing * 4) === 0 ? majorGridColor : gridColor;
        ctx.stroke();

        // Left margin tick labels
        if (y % (gridSpacing * 4) === 0 && y > 0 && y < height - 50) {
          const pLabel = project3D(8, y + 3, 0);
          ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.25)" : "rgba(100, 116, 139, 0.3)";
          ctx.font = "8px monospace";
          ctx.textAlign = "left";
          ctx.fillText(`Y.${String(y).padStart(4, "0")}`, pLabel.x, pLabel.y);
        }
      }

      // Radar Concentric HUD in top-right corner
      const hudCX = width * 0.9;
      const hudCY = height * 0.15;
      const hudR = 90;

      // Circle drawing helper in 3D projection
      const drawRadarCircle = (radius: number, dashed = false) => {
        ctx.beginPath();
        if (dashed) ctx.setLineDash([2, 2]);
        for (let i = 0; i <= 36; i++) {
          const theta = (i * 2 * Math.PI) / 36;
          const p = project3D(hudCX + radius * Math.cos(theta), hudCY + radius * Math.sin(theta), 0);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        if (dashed) ctx.setLineDash([]);
      };

      ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.08)" : "rgba(37, 99, 235, 0.05)";
      ctx.lineWidth = 0.8;

      drawRadarCircle(hudR);
      drawRadarCircle(hudR * 0.6);
      drawRadarCircle(hudR * 0.3, true);

      // crosshairs
      ctx.beginPath();
      const pLeft = project3D(hudCX - hudR - 10, hudCY, 0);
      const pRight = project3D(hudCX + hudR + 10, hudCY, 0);
      const pTop = project3D(hudCX, hudCY - hudR - 10, 0);
      const pBottom = project3D(hudCX, hudCY + hudR + 10, 0);
      
      ctx.moveTo(pLeft.x, pLeft.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.moveTo(pTop.x, pTop.y);
      ctx.lineTo(pBottom.x, pBottom.y);
      ctx.stroke();

      // Radar rotating sweep wedge in 3D perspective
      const pCenter = project3D(hudCX, hudCY, 0);
      const sweepAngle = (baseAngle * 1.5) % (Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(pCenter.x, pCenter.y);
      for (let a = sweepAngle - 0.25; a <= sweepAngle; a += 0.05) {
        const p = project3D(hudCX + hudR * Math.cos(a), hudCY + hudR * Math.sin(a), 0);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      
      const sweepGrad = ctx.createRadialGradient(pCenter.x, pCenter.y, 5, pCenter.x, pCenter.y, hudR * pCenter.scale);
      sweepGrad.addColorStop(0, isDark ? "rgba(6, 182, 212, 0.1)" : "rgba(13, 148, 136, 0.06)");
      sweepGrad.addColorStop(1, isDark ? "rgba(6, 182, 212, 0.0)" : "rgba(13, 148, 136, 0.0)");
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // Sweep leading line
      ctx.beginPath();
      ctx.moveTo(pCenter.x, pCenter.y);
      const pSweepLead = project3D(hudCX + hudR * Math.cos(sweepAngle), hudCY + hudR * Math.sin(sweepAngle), 0);
      ctx.lineTo(pSweepLead.x, pSweepLead.y);
      ctx.strokeStyle = isDark ? "rgba(6, 182, 212, 0.25)" : "rgba(13, 148, 136, 0.2)";
      ctx.stroke();

      // HUD annotations
      const pAnnTop = project3D(hudCX, hudCY - hudR - 14, 0);
      const pAnnBot = project3D(hudCX, hudCY + hudR + 14, 0);

      ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(100, 116, 139, 0.4)";
      ctx.font = "7px monospace";
      ctx.textAlign = "center";
      ctx.fillText("SYS.RADAR.SCAN // R: 1800m", pAnnTop.x, pAnnTop.y);
      ctx.fillText(`AZ: ${(sweepAngle * (180 / Math.PI)).toFixed(1)}°`, pAnnBot.x, pAnnBot.y);

      // Blinking radar target
      const blink = Math.sin(frameCount * 0.1) > 0.3;
      if (blink) {
        const pTarget = project3D(hudCX + hudR * 0.5, hudCY - hudR * 0.3, 0);
        ctx.beginPath();
        ctx.arc(pTarget.x, pTarget.y, 3 * pTarget.scale, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? "rgba(34, 211, 238, 0.8)" : "rgba(13, 148, 136, 0.7)";
        ctx.fill();
        ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(100, 116, 139, 0.4)";
        ctx.font = "7px monospace";
        ctx.fillText("TRGT_01", pTarget.x, pTarget.y - 6);
      }
    };

    // Draw the orthogonal schematic traces and moving pulses in 3D perspective
    const drawSchematic = (isDark: boolean) => {
      ctx.save();
      
      // Draw wires
      ctx.strokeStyle = isDark ? "rgba(6, 182, 212, 0.07)" : "rgba(13, 148, 136, 0.05)";
      ctx.lineWidth = 1.0;
      
      nodes.forEach((node) => {
        node.connectedTo.forEach((targetIdx) => {
          const target = nodes[targetIdx];
          if (!target) return;
          
          const p1 = project3D(node.x, node.y, 0);
          const p2 = project3D(target.x, target.y, 0);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });

        // Draw node circles
        const pNode = project3D(node.x, node.y, 0);
        ctx.beginPath();
        ctx.arc(pNode.x, pNode.y, 2 * pNode.scale, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? "rgba(6, 182, 212, 0.2)" : "rgba(13, 148, 136, 0.15)";
        ctx.fill();
      });

      // Update and draw pulses
      pulses.forEach((pulse) => {
        const fromNode = nodes[pulse.fromNode];
        const toNode = nodes[pulse.toNode];
        
        if (!fromNode || !toNode) return;

        // Linear interpolation
        const currentX = fromNode.x + (toNode.x - fromNode.x) * pulse.progress;
        const currentY = fromNode.y + (toNode.y - fromNode.y) * pulse.progress;

        const pPulse = project3D(currentX, currentY, 0);

        // Draw glowing point
        ctx.beginPath();
        ctx.arc(pPulse.x, pPulse.y, 2.5 * pPulse.scale, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? "rgba(34, 211, 238, 0.7)" : "rgba(13, 148, 136, 0.6)";
        ctx.shadowColor = isDark ? "rgba(34, 211, 238, 0.9)" : "rgba(13, 148, 136, 0.7)";
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow

        // Progress pulse
        pulse.progress += pulse.speed;

        // Recycle pulse
        if (pulse.progress >= 1.0) {
          const nextTargets = toNode.connectedTo;
          if (nextTargets.length > 0) {
            pulse.fromNode = pulse.toNode;
            pulse.toNode = nextTargets[Math.floor(Math.random() * nextTargets.length)];
            pulse.progress = 0;
          } else {
            const candidates = nodes
              .map((n, idx) => ({ node: n, index: idx }))
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
        `FRAME.RENDER: CANVAS3D_PROJ // FPS: ${fpsRef.current}`
      ];

      metricsR.forEach((metric, idx) => {
        ctx.fillText(metric, rightColX, bottomY - (metricsR.length - 1 - idx) * lineH);
      });
    };

    // Blueprint Gear Config definition
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
          parentAngle: -Math.PI / 6,
          outerRadius: 75,
          teeth: 12,
          direction: -1,
          speedMultiplier: 0.6,
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
          parentAngle: Math.PI * 0.75,
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
          speedMultiplier: 0.15,
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

      // Interpolate mouse tilt rotation angles for blueprint plane
      const targetYaw = mouse.x !== -1000 ? (mouse.x - width / 2) * 0.00015 : 0;
      const targetPitch = mouse.y !== -1000 ? -(mouse.y - height / 2) * 0.00012 : 0;
      currentYaw += (targetYaw - currentYaw) * 0.05;
      currentPitch += (targetPitch - currentPitch) * 0.05;

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
