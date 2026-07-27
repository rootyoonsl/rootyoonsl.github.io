"use client";

import { useEffect, useRef } from "react";

const SOURCE_PATH = "/images/background.png";
const CLOUD_START_RATIO = 40 / 1086;
const CLOUD_END_RATIO = 475 / 1086;
const WATER_START_RATIO = 812 / 1086;
const WATER_FADE_PIXELS = 28;
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const FRAME_INTERVAL = 1000 / 30;

type PixelAnalysis = {
  source: HTMLCanvasElement;
  rowTexture: Float32Array;
  width: number;
  height: number;
};

type CoverMetrics = {
  scale: number;
  width: number;
  height: number;
  left: number;
  top: number;
};

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getCoverMetrics(
  sourceWidth: number,
  sourceHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): CoverMetrics {
  const scale = Math.max(
    viewportWidth / sourceWidth,
    viewportHeight / sourceHeight,
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    scale,
    width,
    height,
    left: (viewportWidth - width) / 2,
    top: (viewportHeight - height) / 2,
  };
}

function normalizeTextureRange(
  rawTexture: Float32Array,
  normalizedTexture: Float32Array,
  start: number,
  end: number,
) {
  const values = Array.from(rawTexture.slice(start, end)).sort(
    (left, right) => left - right,
  );

  if (values.length === 0) {
    return;
  }

  const low = values[Math.floor(values.length * 0.15)] ?? 0;
  const high = values[Math.floor(values.length * 0.9)] ?? low + 1;
  const range = Math.max(0.0001, high - low);

  for (let y = start; y < end; y += 1) {
    normalizedTexture[y] = 0.28 + clamp((rawTexture[y] - low) / range) * 0.72;
  }
}

function analyzeSourcePixels(image: HTMLImageElement): PixelAnalysis | null {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const source = document.createElement("canvas");
  const sourceContext = source.getContext("2d", {
    willReadFrequently: true,
  });

  if (!sourceContext) {
    return null;
  }

  source.width = width;
  source.height = height;
  sourceContext.imageSmoothingEnabled = false;
  sourceContext.drawImage(image, 0, 0);

  let pixels: ImageData;

  try {
    pixels = sourceContext.getImageData(0, 0, width, height);
  } catch {
    const fallbackTexture = new Float32Array(height);
    fallbackTexture.fill(0.65);
    return { source, rowTexture: fallbackTexture, width, height };
  }

  const rawTexture = new Float32Array(height);
  const smoothedTexture = new Float32Array(height);
  const rowTexture = new Float32Array(height);
  const data = pixels.data;

  // Read every source pixel once. Horizontal color changes form a texture
  // weight, so detailed cloud and reflection rows react more than empty sky.
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width * 4;
    let previousRed = data[rowOffset];
    let previousGreen = data[rowOffset + 1];
    let previousBlue = data[rowOffset + 2];
    let previousLuminance =
      previousRed * 0.2126 +
      previousGreen * 0.7152 +
      previousBlue * 0.0722;
    let detail = 0;

    for (let x = 1; x < width; x += 1) {
      const offset = rowOffset + x * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;

      detail +=
        Math.abs(luminance - previousLuminance) +
        (Math.abs(red - previousRed) +
          Math.abs(green - previousGreen) +
          Math.abs(blue - previousBlue)) *
          0.08;
      previousRed = red;
      previousGreen = green;
      previousBlue = blue;
      previousLuminance = luminance;
    }

    rawTexture[y] = detail / Math.max(1, width - 1);
  }

  for (let y = 0; y < height; y += 1) {
    let total = 0;
    let samples = 0;

    for (
      let sampleY = Math.max(0, y - 3);
      sampleY <= Math.min(height - 1, y + 3);
      sampleY += 1
    ) {
      total += rawTexture[sampleY];
      samples += 1;
    }

    smoothedTexture[y] = total / samples;
  }

  rowTexture.fill(0.5);
  normalizeTextureRange(
    smoothedTexture,
    rowTexture,
    Math.round(height * CLOUD_START_RATIO),
    Math.round(height * CLOUD_END_RATIO),
  );
  normalizeTextureRange(
    smoothedTexture,
    rowTexture,
    Math.round(height * WATER_START_RATIO),
    height,
  );

  return { source, rowTexture, width, height };
}

export function InteractiveCover() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const activeCanvas: HTMLCanvasElement = canvas;
    const activeContext: CanvasRenderingContext2D = context;
    const image = new Image();
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      energy: 0,
    };
    let analysis: PixelAnalysis | null = null;
    let viewportWidth = 0;
    let viewportHeight = 0;
    let animationFrame = 0;
    let lastFrame = 0;
    let imageReady = false;
    let reducedMotion = reducedMotionQuery.matches;

    function scheduleFrame() {
      if (animationFrame === 0 && !document.hidden) {
        animationFrame = window.requestAnimationFrame(drawFrame);
      }
    }

    function resizeCanvas() {
      const bounds = activeCanvas.getBoundingClientRect();
      const devicePixelRatio = Math.min(
        window.devicePixelRatio || 1,
        MAX_DEVICE_PIXEL_RATIO,
      );
      viewportWidth = Math.max(1, bounds.width);
      viewportHeight = Math.max(1, bounds.height);
      const nextWidth = Math.round(viewportWidth * devicePixelRatio);
      const nextHeight = Math.round(viewportHeight * devicePixelRatio);

      if (
        activeCanvas.width !== nextWidth ||
        activeCanvas.height !== nextHeight
      ) {
        activeCanvas.width = nextWidth;
        activeCanvas.height = nextHeight;
      }

      activeContext.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0,
      );
      activeContext.imageSmoothingEnabled = false;

      if (imageReady) {
        scheduleFrame();
      }
    }

    function drawSlice(
      source: HTMLCanvasElement,
      metrics: CoverMetrics,
      sourceY: number,
      sourceHeight: number,
      xOffset: number,
      yOffset = 0,
    ) {
      activeContext.drawImage(
        source,
        0,
        sourceY,
        source.width,
        sourceHeight,
        metrics.left + xOffset * metrics.scale,
        metrics.top + sourceY * metrics.scale + yOffset * metrics.scale,
        metrics.width,
        Math.ceil(sourceHeight * metrics.scale) + 1,
      );
    }

    function drawFrame(time: number) {
      animationFrame = 0;

      if (!imageReady || !analysis) {
        return;
      }

      if (
        !reducedMotion &&
        lastFrame > 0 &&
        time - lastFrame < FRAME_INTERVAL
      ) {
        scheduleFrame();
        return;
      }

      const elapsed = lastFrame > 0 ? Math.min(64, time - lastFrame) : 16;
      lastFrame = time;
      const easing = 1 - Math.exp(-elapsed / 120);
      pointer.x += (pointer.targetX - pointer.x) * easing;
      pointer.y += (pointer.targetY - pointer.y) * easing;
      pointer.energy *= Math.exp(-elapsed / 420);

      const metrics = getCoverMetrics(
        analysis.width,
        analysis.height,
        viewportWidth,
        viewportHeight,
      );

      activeContext.clearRect(0, 0, viewportWidth, viewportHeight);
      activeContext.drawImage(
        analysis.source,
        metrics.left,
        metrics.top,
        metrics.width,
        metrics.height,
      );

      if (reducedMotion) {
        return;
      }

      const cloudStart = Math.round(analysis.height * CLOUD_START_RATIO);
      const cloudEnd = Math.round(analysis.height * CLOUD_END_RATIO);
      const cloudSliceHeight = Math.max(8, Math.round(analysis.height / 130));

      for (
        let sourceY = cloudStart;
        sourceY < cloudEnd;
        sourceY += cloudSliceHeight
      ) {
        const sliceHeight = Math.min(
          cloudSliceHeight,
          cloudEnd - sourceY,
        );
        const middleRow = Math.min(
          analysis.height - 1,
          sourceY + Math.floor(sliceHeight / 2),
        );
        const textureWeight = analysis.rowTexture[middleRow];
        const altitude = 1 - (sourceY - cloudStart) / (cloudEnd - cloudStart);
        const idleDrift =
          Math.sin(time * 0.00042 + sourceY * 0.025) *
          1.6 *
          textureWeight;
        const pointerDrift =
          pointer.x * (3 + altitude * 3) * textureWeight;
        const movementRipple =
          Math.sin(time * 0.003 + sourceY * 0.105) *
          pointer.energy *
          3.5 *
          textureWeight;

        drawSlice(
          analysis.source,
          metrics,
          sourceY,
          sliceHeight,
          Math.round(idleDrift + pointerDrift + movementRipple),
        );
      }

      const waterStart = Math.round(analysis.height * WATER_START_RATIO);
      const waterSliceHeight = Math.max(3, Math.round(analysis.height / 270));

      for (
        let sourceY = waterStart;
        sourceY < analysis.height;
        sourceY += waterSliceHeight
      ) {
        const sliceHeight = Math.min(
          waterSliceHeight,
          analysis.height - sourceY,
        );
        const middleRow = Math.min(
          analysis.height - 1,
          sourceY + Math.floor(sliceHeight / 2),
        );
        const textureWeight = analysis.rowTexture[middleRow];
        const depth =
          (sourceY - waterStart) / (analysis.height - waterStart);
        const boundaryFade = clamp(
          (sourceY - waterStart) / WATER_FADE_PIXELS,
        );
        const primaryWave =
          Math.sin(time * 0.0021 + sourceY * 0.11) *
          (2 + depth * 3.5) *
          textureWeight;
        const crossingWave =
          Math.sin(time * 0.00135 - sourceY * 0.064) *
          (0.8 + depth * 2);
        const pointerWave =
          pointer.x * (2 + depth * 6) +
          Math.sin(time * 0.0042 + sourceY * 0.145) *
            pointer.energy *
            (3 + depth * 7);
        const verticalWave =
          Math.cos(time * 0.0025 + sourceY * 0.078) *
          pointer.energy *
          depth *
          0.8;

        drawSlice(
          analysis.source,
          metrics,
          sourceY,
          sliceHeight,
          Math.round(
            (primaryWave + crossingWave + pointerWave) * boundaryFade,
          ),
          Math.round(verticalWave * boundaryFade),
        );
      }

      scheduleFrame();
    }

    function handlePointerMove(event: PointerEvent) {
      const bounds = activeCanvas.getBoundingClientRect();
      const nextX = clamp((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const nextY = clamp((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      const movement = Math.hypot(
        nextX - pointer.targetX,
        nextY - pointer.targetY,
      );

      pointer.targetX = nextX;
      pointer.targetY = nextY;
      pointer.energy = clamp(pointer.energy + movement * 2.4);
      scheduleFrame();
    }

    function handlePointerLeave() {
      pointer.targetX = 0;
      pointer.targetY = 0;
      scheduleFrame();
    }

    function handleReducedMotion(event: MediaQueryListEvent) {
      reducedMotion = event.matches;
      lastFrame = 0;
      scheduleFrame();
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        if (animationFrame !== 0) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
      } else {
        lastFrame = 0;
        scheduleFrame();
      }
    }

    image.decoding = "async";
    image.onload = () => {
      analysis = analyzeSourcePixels(image);
      imageReady = analysis !== null;
      resizeCanvas();
      scheduleFrame();
    };
    image.src = SOURCE_PATH;

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(activeCanvas);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("blur", handlePointerLeave);
    document.addEventListener("mouseleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", handleReducedMotion);

    return () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", handlePointerLeave);
      document.removeEventListener("mouseleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener("change", handleReducedMotion);
      image.onload = null;
    };
  }, []);

  return (
    <canvas
      className="home-interactive-cover"
      ref={canvasRef}
      aria-hidden="true"
    />
  );
}
