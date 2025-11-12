import React, { useState, useRef, useCallback, useEffect } from 'react';
import './VideoUploader.css';

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
        onVideoUpload(file);
      }
    }
  }, [onVideoUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      if (validateFile(file)) {
        onVideoUpload(file);
      }
    }
  }, [onVideoUpload]);

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
                background: 'rgba(255, 152, 0, 0.1)',
                borderLeft: '3px solid var(--warning)',
                borderRadius: '4px',
                marginTop: '12px',
                fontSize: '14px',
                color: 'var(--text-primary)'
              }}>
                ⚠️ Большой размер файла ({formatFileSize(video.size)}) может замедлить обработку
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