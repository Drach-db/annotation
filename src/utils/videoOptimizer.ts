// Простое решение для оптимизации видео без FFmpeg WASM
// Используем встроенную поддержку браузера для проверки и рекомендаций

export interface VideoAnalysis {
  sizeMB: number;
  duration: number;
  bitrateMbps: number;
  resolution: { width: number; height: number };
  isOptimal: boolean;
  recommendation: 'none' | 'compress' | 'transcode';
  estimatedOptimalSizeMB?: number;
}

export function analyzeVideo(file: File, metadata: { duration: number; width: number; height: number }): VideoAnalysis {
  const sizeMB = file.size / (1024 * 1024);
  const bitrateMbps = (file.size * 8) / (metadata.duration * 1000000);

  // Определяем оптимальный размер на основе длительности
  // Целевой битрейт: 2-4 Мбит/с для онлайн обработки
  const targetBitrateMbps = 2.5;
  const estimatedOptimalSizeMB = (metadata.duration * targetBitrateMbps * 1000000 / 8) / (1024 * 1024);

  let isOptimal = sizeMB <= 50;
  let recommendation: 'none' | 'compress' | 'transcode' = 'none';

  if (sizeMB > 100) {
    recommendation = 'transcode'; // Требуется серьезная обработка
  } else if (sizeMB > 50) {
    recommendation = 'compress'; // Легкое сжатие
  }

  return {
    sizeMB,
    duration: metadata.duration,
    bitrateMbps,
    resolution: { width: metadata.width, height: metadata.height },
    isOptimal,
    recommendation,
    estimatedOptimalSizeMB
  };
}

export function getCompressionCommand(file: File, quality: 'low' | 'medium' | 'high'): string {
  const qualitySettings = {
    low: { crf: 35, resolution: '640x360' },
    medium: { crf: 28, resolution: '1280x720' },
    high: { crf: 23, resolution: '1920x1080' }
  };

  const settings = qualitySettings[quality];

  return `ffmpeg -i "${file.name}" -vf scale=${settings.resolution} -c:v libx264 -crf ${settings.crf} -preset medium -c:a aac -b:a 128k output.mp4`;
}

export function getHandBrakeSettings(quality: 'low' | 'medium' | 'high'): string {
  const presets = {
    low: 'Fast 480p30',
    medium: 'Fast 720p30',
    high: 'Fast 1080p30'
  };

  return presets[quality];
}