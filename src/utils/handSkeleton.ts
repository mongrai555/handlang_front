export interface Landmark {
  x: number;
  y: number;
  z?: number;
  name?: string;
}

export const FINGER_LANDMARK_NAMES: string[] = [
  "0. Wrist",
  "1. Thumb CMC",
  "2. Thumb MCP",
  "3. Thumb IP",
  "4. Thumb Tip",
  "5. Index MCP",
  "6. Index PIP",
  "7. Index DIP",
  "8. Index Tip",
  "9. Middle MCP",
  "10. Middle PIP",
  "11. Middle DIP",
  "12. Middle Tip",
  "13. Ring MCP",
  "14. Ring PIP",
  "15. Ring DIP",
  "16. Ring Tip",
  "17. Pinky MCP",
  "18. Pinky PIP",
  "19. Pinky DIP",
  "20. Pinky Tip",
];

// Finger joint connections
export const FINGER_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index Finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle Finger
  [9, 10], [10, 11], [11, 12],
  // Ring Finger
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm connections
  [5, 9], [9, 13], [13, 17],
];

// Connection colors by finger group
export function getBoneColor(startIdx: number, endIdx: number): string {
  if (startIdx >= 1 && endIdx <= 4) return "#10b981"; // Thumb: Emerald
  if (startIdx >= 5 && endIdx <= 8) return "#06b6d4"; // Index: Cyan
  if (startIdx >= 9 && endIdx <= 12) return "#6366f1"; // Middle: Indigo
  if (startIdx >= 13 && endIdx <= 16) return "#a855f7"; // Ring: Purple
  if (startIdx >= 17 && endIdx <= 20) return "#ec4899"; // Pinky: Rose
  return "#f59e0b"; // Palm / Wrist: Amber
}

// Joint node colors
export function getJointColor(idx: number): string {
  if (idx === 0) return "#f59e0b"; // Wrist
  if (idx >= 1 && idx <= 4) return "#10b981"; // Thumb
  if (idx >= 5 && idx <= 8) return "#06b6d4"; // Index
  if (idx >= 9 && idx <= 12) return "#6366f1"; // Middle
  if (idx >= 13 && idx <= 16) return "#a855f7"; // Ring
  if (idx >= 17 && idx <= 20) return "#ec4899"; // Pinky
  return "#ffffff";
}

/**
 * Draws the 21 hand landmarks and skeleton onto HTML5 Canvas
 */
export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  keypoints: Landmark[],
  isFlipped: boolean = false,
  canvasWidth: number = 640
) {
  if (!keypoints || keypoints.length < 21) return;

  // Transform coordinates if video is mirrored
  const points = keypoints.map((kp) => ({
    x: isFlipped ? canvasWidth - kp.x : kp.x,
    y: kp.y,
    z: kp.z || 0,
  }));

  // 1. Draw Skeleton Connection Lines (Bones)
  FINGER_CONNECTIONS.forEach(([start, end]) => {
    const p1 = points[start];
    const p2 = points[end];

    if (p1 && p2) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = getBoneColor(start, end);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.shadowColor = getBoneColor(start, end);
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow
    }
  });

  // 2. Draw 21 Joint Nodes
  points.forEach((pt, idx) => {
    const isTip = [4, 8, 12, 16, 20].includes(idx);
    const radius = isTip ? 7 : idx === 0 ? 8 : 5;
    const color = getJointColor(idx);

    // Outer Glow Ring
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius + 3, 0, 2 * Math.PI);
    ctx.fillStyle = `${color}44`;
    ctx.fill();

    // Solid Node Center
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label Node Number on Tip
    if (isTip) {
      ctx.font = "bold 10px Inter, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${idx}`, pt.x + 10, pt.y + 4);
    }
  });
}

/**
 * Normalizes 21 3D finger landmarks to be position- and scale-invariant
 * - Centers relative to Wrist (Keypoint 0)
 * - Scales relative to distance from Wrist to Middle Finger MCP (Keypoint 9)
 */
export function normalizeLandmarks(keypoints: Landmark[]): Landmark[] {
  if (!keypoints || keypoints.length < 21) return [];

  const wrist = keypoints[0];

  // Calculate scaling factor (distance from Wrist to Middle MCP)
  const middleMcp = keypoints[9];
  const dx = middleMcp.x - wrist.x;
  const dy = middleMcp.y - wrist.y;
  const dz = (middleMcp.z || 0) - (wrist.z || 0);
  const scale = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

  return keypoints.map((kp) => ({
    x: (kp.x - wrist.x) / scale,
    y: (kp.y - wrist.y) / scale,
    z: ((kp.z || 0) - (wrist.z || 0)) / scale,
    name: kp.name,
  }));
}

/**
 * Calculates average Euclidean distance between two sets of normalized landmarks.
 * Lower score = higher matching similarity.
 */
export function calculateLandmarkDistance(
  kp1: Landmark[],
  kp2: Landmark[]
): number {
  if (!kp1 || !kp2 || kp1.length < 21 || kp2.length < 21) return Infinity;

  const norm1 = normalizeLandmarks(kp1);
  const norm2 = normalizeLandmarks(kp2);

  let totalDist = 0;
  for (let i = 0; i < 21; i++) {
    const dx = norm1[i].x - norm2[i].x;
    const dy = norm1[i].y - norm2[i].y;
    const dz = (norm1[i].z || 0) - (norm2[i].z || 0);
    totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return totalDist / 21;
}

