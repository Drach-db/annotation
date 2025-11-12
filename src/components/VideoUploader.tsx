import React, { useState, useRef, useCallback, useEffect } from 'react';
import './VideoUploader.css';
import { analyzeVideo, getCompressionCommand, getHandBrakeSettings } from '../utils/videoOptimizer';

interface VideoUploaderProps {
  video: File | null;
  onVideoUpload: (file: File) => void;
  onVideoDurationChange?: (duration: number) => void;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fileSize: string;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ video, onVideoUpload, onVideoDurationChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(2) + ' MB';
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (video) {
      const url = URL.createObjectURL(video);
      setVideoUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setVideoUrl('');
      setMetadata(null);
    }
  }, [video]);

  const handleVideoLoad = useCallback(() => {
    if (videoRef.current && video) {
      const videoElement = videoRef.current;
      const duration = videoElement.duration;

      setMetadata({
        duration: duration,
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
        fileSize: formatFileSize(video.size),
      });

      // Notify parent about video duration
      if (onVideoDurationChange) {
        onVideoDurationChange(duration);
      }
    }
  }, [video, onVideoDurationChange]);

  const validateFile = (file: File): boolean => {
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const maxSize = 500 * 1024 * 1024; // 500MB

    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid video file (MP4, WebM, or MOV)');
      return false;
    }

    if (file.size > maxSize) {
      alert('File size must be less than 500MB');
      return false;
    }

    return true;
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0]) {
      const file = files[0];
      if (validateFile(file)) {
        checkFileAndUpload(file);
      }
    }
  }, [onVideoUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      if (validateFile(file)) {
        checkFileAndUpload(file);
      }
    }
  }, [onVideoUpload]);

  const checkFileAndUpload = async (file: File) => {
    // Get video metadata first
    const videoElement = document.createElement('video');
    videoElement.src = URL.createObjectURL(file);
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = resolve;
    });

    const analysis = analyzeVideo(file, {
      duration: videoElement.duration,
      width: videoElement.videoWidth,
      height: videoElement.videoHeight
    });

    URL.revokeObjectURL(videoElement.src);

    if (!analysis.isOptimal && analysis.recommendation !== 'none') {
      setPendingFile(file);
      setShowOptimizationDialog(true);
    } else {
      onVideoUpload(file);
    }
  };

  const handleSkipOptimization = () => {
    if (pendingFile) {
      onVideoUpload(pendingFile);
      setShowOptimizationDialog(false);
      setPendingFile(null);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const clearVideo = () => {
    onVideoUpload(null as any);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onVideoDurationChange) {
      onVideoDurationChange(0);
    }
  };

  return (
    <div className="video-uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Optimization Dialog */}
      {showOptimizationDialog && pendingFile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#ff5722' }}>
              ⚠️ Видео требует оптимизации
            </h3>

            {(() => {
              const videoElement = document.createElement('video');
              videoElement.src = URL.createObjectURL(pendingFile);
              const analysis = analyzeVideo(pendingFile, {
                duration: metadata?.duration || 30,
                width: metadata?.width || 1920,
                height: metadata?.height || 1080
              });

              return (
                <>
                  <div style={{
                    background: '#fff3e0',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '20px'
                  }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
                      <strong>Текущий файл:</strong> {formatFileSize(pendingFile.size)}
                    </p>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
                      <strong>Битрейт:</strong> {analysis.bitrateMbps.toFixed(1)} Мбит/с
                      (рекомендуется: 2-4 Мбит/с)
                    </p>
                    <p style={{ margin: '0', fontSize: '14px' }}>
                      <strong>Оптимальный размер:</strong> ~{analysis.estimatedOptimalSizeMB?.toFixed(0)} MB
                    </p>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                      Как оптимизировать видео:
                    </h4>

                    <div style={{ marginBottom: '16px' }}>
                      <strong style={{ fontSize: '14px' }}>Вариант 1: FFmpeg (командная строка)</strong>
                      <pre style={{
                        background: '#f5f5f5',
                        padding: '8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        overflowX: 'auto',
                        marginTop: '4px'
                      }}>
                        {getCompressionCommand(pendingFile, 'medium')}
                      </pre>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <strong style={{ fontSize: '14px' }}>Вариант 2: HandBrake (GUI)</strong>
                      <p style={{ fontSize: '13px', margin: '4px 0' }}>
                        Скачайте HandBrake с <a href="https://handbrake.fr" target="_blank" rel="noopener noreferrer">handbrake.fr</a>
                      </p>
                      <p style={{ fontSize: '13px', margin: '4px 0' }}>
                        Используйте пресет: <code>{getHandBrakeSettings('medium')}</code>
                      </p>
                    </div>

                    <div>
                      <strong style={{ fontSize: '14px' }}>Вариант 3: Онлайн сервисы</strong>
                      <ul style={{ fontSize: '13px', margin: '4px 0', paddingLeft: '20px' }}>
                        <li>CloudConvert.com</li>
                        <li>Clideo.com</li>
                        <li>FreeConvert.com</li>
                      </ul>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={handleSkipOptimization}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#ff5722',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Продолжить без оптимизации
                    </button>
                    <button
                      onClick={() => {
                        setShowOptimizationDialog(false);
                        setPendingFile(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#f5f5f5',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''} ${video ? 'has-video' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={!video ? handleClick : undefined}
      >
        {!video ? (
          <div className="upload-placeholder">
            <svg
              className="video-icon"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15.5 11.5L9.5 7.5V15.5L15.5 11.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            <p className="upload-text">Перетащите видео или нажмите для выбора</p>
            <small className="upload-hint">MP4, WebM, MOV до 500MB</small>
          </div>
        ) : (
          <div className="video-preview">
            <video
              ref={videoRef}
              controls
              src={videoUrl}
              onLoadedMetadata={handleVideoLoad}
              className="preview-video"
            />
            {metadata && (
              <div className="video-metadata">
                <div className="metadata-row">
                  <span className="metadata-label">Длительность:</span>
                  <span className="metadata-value">{formatDuration(metadata.duration)}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Разрешение:</span>
                  <span className="metadata-value">{metadata.width}×{metadata.height}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Размер:</span>
                  <span className="metadata-value">{metadata.fileSize}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Файл:</span>
                  <span className="metadata-value" title={video.name}>
                    {video.name.length > 30
                      ? `${video.name.substring(0, 27)}...`
                      : video.name}
                  </span>
                </div>
              </div>
            )}
            {video && video.size > 10 * 1024 * 1024 && (
              <div style={{
                padding: '12px',
                background: video.size > 100 * 1024 * 1024 ? 'rgba(255, 87, 34, 0.1)' : 'rgba(255, 152, 0, 0.1)',
                borderLeft: video.size > 100 * 1024 * 1024 ? '3px solid var(--error)' : '3px solid var(--warning)',
                borderRadius: '4px',
                marginTop: '12px',
                fontSize: '14px',
                color: 'var(--text-primary)'
              }}>
                {video.size > 100 * 1024 * 1024 ? '⚠️' : '⚠️'}
                {' '}<strong>Размер файла: {formatFileSize(video.size)}</strong>
                <div style={{ marginTop: '8px', fontSize: '13px', lineHeight: '1.5' }}>
                  {video.size > 100 * 1024 * 1024 ? (
                    <>
                      <strong>Проблема:</strong> Файл слишком большой для эффективной обработки через base64.
                      <br />
                      <strong>Причина:</strong> Высокий битрейт видео (~{Math.round(video.size / metadata?.duration! / 125000)} Мбит/с)
                      <br />
                      <strong>Рекомендации:</strong>
                      <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                        <li>Используйте сжатие видео (HandBrake, FFmpeg)</li>
                        <li>Уменьшите разрешение до 720p</li>
                        <li>Целевой размер: до 50MB для оптимальной скорости</li>
                      </ul>
                    </>
                  ) : (
                    <>Файл может обрабатываться дольше обычного. Рекомендуем сжать до 50MB для быстрой обработки.</>
                  )}
                </div>
              </div>
            )}
            <button
              className="replace-video-btn secondary"
              onClick={clearVideo}
            >
              Заменить видео
            </button>
          </div>
        )}
      </div>
    </div>
  );
};