export interface TokenEstimate {
  duration: number;
  fps: number;
  numFrames: number;
  resolution: [number, number];
  tokensPerFrame: number;
  totalTokens: number;
  recommended: boolean;
  warning?: string;
}

export interface OptimizationSuggestion {
  fps: number;
  resolution: [number, number];
  estimate: TokenEstimate;
}

/**
 * Estimate token usage for video processing with Qwen3-VL
 * Based on compression ratio of 32 for the model
 */
export function estimateTokenUsage(
  videoDuration: number,
  fps: number,
  resolution: [number, number]
): TokenEstimate {
  // Calculate number of frames
  const numFrames = Math.floor(videoDuration * fps);

  // Round resolution to nearest 32 (Qwen3-VL requirement)
  const h = Math.ceil(resolution[0] / 32) * 32;
  const w = Math.ceil(resolution[1] / 32) * 32;

  // Compression ratio = 32 for Qwen3-VL
  // Each frame's tokens = (height * width) / (32 * 32)
  const tokensPerFrame = Math.ceil((h * w) / (32 * 32));
  const totalTokens = numFrames * tokensPerFrame;

  // Add prompt tokens estimate (roughly 100-500 tokens for prompt)
  const estimatedTotalWithPrompt = totalTokens + 300;

  let warning: string | undefined;
  let recommended = true;

  if (estimatedTotalWithPrompt > 32768) {
    recommended = false;
    warning = 'Превышен максимальный лимит токенов (32768). Видео не будет обработано.';
  } else if (estimatedTotalWithPrompt > 16384) {
    recommended = false;
    warning = 'Превышен рекомендуемый лимит (16384). Может работать медленно или неточно.';
  } else if (estimatedTotalWithPrompt > 8192) {
    warning = 'Приближаетесь к оптимальному лимиту. Рассмотрите снижение параметров.';
  }

  return {
    duration: videoDuration,
    fps,
    numFrames,
    resolution: [h, w],
    tokensPerFrame,
    totalTokens: estimatedTotalWithPrompt,
    recommended,
    warning,
  };
}

/**
 * Find optimal parameters for a given video duration and target token count
 */
export function optimizeParameters(
  videoDuration: number,
  targetTokens: number = 8000,
  preferQuality: boolean = false
): OptimizationSuggestion {
  const resolutionOptions: [number, number][] = [
    [224, 224], // Minimum quality
    [256, 256],
    [280, 280], // Balanced
    [320, 320],
    [360, 360], // Good quality
    [384, 384],
    [416, 416],
    [448, 448],
    [480, 480], // High quality
    [512, 512],
    [544, 544],
    [576, 576],
    [608, 608],
    [640, 640], // Maximum quality
  ];

  const fpsOptions = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];

  let bestConfig: OptimizationSuggestion | null = null;
  let bestScore = Infinity;

  for (const res of resolutionOptions) {
    for (const fps of fpsOptions) {
      const estimate = estimateTokenUsage(videoDuration, fps, res);

      // Skip if over hard limit
      if (estimate.totalTokens > 32768) continue;

      // Calculate score based on token usage and quality
      const tokenDiff = Math.abs(estimate.totalTokens - targetTokens);
      const qualityScore = preferQuality
        ? 1 / (res[0] * res[1] * fps) // Inverse for quality preference
        : (res[0] * res[1] * fps) / 1000000; // Direct for performance preference

      const score = tokenDiff + qualityScore * 1000;

      if (score < bestScore && estimate.recommended) {
        bestScore = score;
        bestConfig = { fps, resolution: res, estimate };
      }
    }
  }

  // If no recommended config found, find the best non-recommended one
  if (!bestConfig) {
    bestScore = Infinity;
    for (const res of resolutionOptions) {
      for (const fps of fpsOptions) {
        const estimate = estimateTokenUsage(videoDuration, fps, res);
        if (estimate.totalTokens <= targetTokens && estimate.totalTokens < bestScore) {
          bestScore = estimate.totalTokens;
          bestConfig = { fps, resolution: res, estimate };
        }
      }
    }
  }

  // Fallback to minimal config if still nothing found
  if (!bestConfig) {
    const estimate = estimateTokenUsage(videoDuration, 1.0, [224, 224]);
    bestConfig = { fps: 1.0, resolution: [224, 224], estimate };
  }

  return bestConfig;
}

/**
 * Get recommended presets based on video duration
 */
export function getRecommendedPresets(videoDuration: number): {
  fast: OptimizationSuggestion;
  balanced: OptimizationSuggestion;
  quality: OptimizationSuggestion;
} {
  // Fast: Optimize for speed (lower tokens)
  const fast = optimizeParameters(videoDuration, 4000, false);

  // Balanced: Medium token usage
  const balanced = optimizeParameters(videoDuration, 8000, false);

  // Quality: Optimize for quality (higher tokens but under limit)
  const quality = optimizeParameters(videoDuration, 12000, true);

  return { fast, balanced, quality };
}

/**
 * Calculate pixel control parameters for long videos
 */
export function calculatePixelControl(
  videoDuration: number,
  targetQuality: 'low' | 'medium' | 'high' = 'medium'
): {
  minPixels: number;
  maxPixels: number;
  totalPixels?: number;
} {
  const qualitySettings = {
    low: {
      minPixels: 224 * 32 * 32,
      maxPixels: 448 * 32 * 32,
    },
    medium: {
      minPixels: 256 * 32 * 32,
      maxPixels: 768 * 32 * 32,
    },
    high: {
      minPixels: 384 * 32 * 32,
      maxPixels: 1280 * 32 * 32,
    },
  };

  const settings = qualitySettings[targetQuality];

  // For very long videos (>60s), set totalPixels to limit overall usage
  if (videoDuration > 60) {
    const totalPixels = Math.floor(videoDuration * 2 * settings.maxPixels);
    return { ...settings, totalPixels };
  }

  return settings;
}

/**
 * Validate if parameters are within acceptable limits
 */
export function validateParameters(
  fps: number,
  resolution: [number, number],
  videoDuration: number
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // FPS validation
  if (fps < 0.5) errors.push('FPS должен быть не менее 0.5');
  if (fps > 8) errors.push('FPS не должен превышать 8');

  // Resolution validation
  if (resolution[0] < 224 || resolution[1] < 224) {
    errors.push('Минимальное разрешение 224x224');
  }
  if (resolution[0] > 640 || resolution[1] > 640) {
    warnings.push('Разрешение выше 640x640 может быть избыточным');
  }

  // Token estimation
  const estimate = estimateTokenUsage(videoDuration, fps, resolution);
  if (estimate.totalTokens > 32768) {
    errors.push('Параметры приведут к превышению лимита токенов');
  }
  if (estimate.warning) {
    warnings.push(estimate.warning);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}