import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;

export async function loadFFmpeg(): Promise<void> {
  if (ffmpegLoaded) return;

  ffmpeg = new FFmpeg();

  // Load FFmpeg WASM
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
  });

  ffmpegLoaded = true;
}

export interface CompressionOptions {
  targetSizeMB?: number;
  quality?: 'low' | 'medium' | 'high';
  maxWidth?: number;
  maxHeight?: number;
  onProgress?: (progress: number) => void;
}

export async function compressVideo(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    targetSizeMB = 50,
    quality = 'medium',
    maxWidth = 1280,
    maxHeight = 720,
    onProgress,
  } = options;

  if (!ffmpeg || !ffmpegLoaded) {
    await loadFFmpeg();
  }

  if (!ffmpeg) {
    throw new Error('FFmpeg не удалось загрузить');
  }

  // Calculate target bitrate based on file size and duration
  const videoElement = document.createElement('video');
  videoElement.src = URL.createObjectURL(file);
  await new Promise((resolve) => {
    videoElement.onloadedmetadata = resolve;
  });
  const duration = videoElement.duration;
  URL.revokeObjectURL(videoElement.src);

  // Target bitrate in kbps (leave some room for audio)
  const targetBitrate = Math.floor((targetSizeMB * 8 * 1024) / duration - 128);

  // Quality presets
  const qualitySettings = {
    low: { crf: 35, preset: 'veryfast' },
    medium: { crf: 28, preset: 'faster' },
    high: { crf: 23, preset: 'medium' },
  };

  const { crf, preset } = qualitySettings[quality];

  try {
    // Write input file
    await ffmpeg.writeFile('input.mp4', await fetchFile(file));

    // Set up progress monitoring
    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        onProgress(progress);
      });
    }

    // Compress video with FFmpeg
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-vf', `scale='min(${maxWidth},iw)':min'(${maxHeight},ih)':force_original_aspect_ratio=decrease`,
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', crf.toString(),
      '-b:v', `${targetBitrate}k`,
      '-maxrate', `${targetBitrate * 1.5}k`,
      '-bufsize', `${targetBitrate * 2}k`,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      'output.mp4'
    ]);

    // Read compressed file
    const data = await ffmpeg.readFile('output.mp4');
    const blob = new Blob([data], { type: 'video/mp4' });
    const compressedFile = new File([blob], file.name, { type: 'video/mp4' });

    // Clean up
    await ffmpeg.deleteFile('input.mp4');
    await ffmpeg.deleteFile('output.mp4');

    return compressedFile;
  } catch (error) {
    console.error('Ошибка при сжатии видео:', error);
    throw error;
  }
}

export async function estimateCompressedSize(
  file: File,
  quality: 'low' | 'medium' | 'high' = 'medium'
): Promise<number> {
  // Rough estimation based on quality
  const compressionRatios = {
    low: 0.1,    // ~90% compression
    medium: 0.25, // ~75% compression
    high: 0.5,    // ~50% compression
  };

  return file.size * compressionRatios[quality];
}