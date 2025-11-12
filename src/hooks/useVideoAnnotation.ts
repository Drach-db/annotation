import { useState, useCallback, useRef } from 'react';
import { DashScopeService, AnnotationResponse } from '../services/dashscopeApi';
import { VideoParameters } from '../components/ParametersPanel';
import { AnnotationType, ANNOTATION_PROMPTS } from '../components/PromptSelector';
import { validateParameters } from '../utils/tokenEstimator';

interface UseVideoAnnotationReturn {
  // State
  video: File | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  parameters: VideoParameters;
  annotationType: AnnotationType;
  customPrompt: string;
  annotation: AnnotationResponse | null;
  isProcessing: boolean;
  error: { message: string; code?: string } | null;
  success: boolean;
  progress: number;
  currentStage: string;
  currentStageDetail: string;

  // Actions
  uploadVideo: (file: File | null) => void;
  updateParameters: (params: Partial<VideoParameters>) => void;
  selectAnnotationType: (type: AnnotationType) => void;
  updateCustomPrompt: (prompt: string) => void;
  startAnnotation: () => Promise<void>;
  cancelAnnotation: () => void;
  resetAnnotation: () => void;
  retryAnnotation: () => void;
}

export function useVideoAnnotation(apiKey: string): UseVideoAnnotationReturn {
  // Video state
  const [video, setVideo] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Parameters state
  const [parameters, setParameters] = useState<VideoParameters>({
    fps: 2.0,
    resizedHeight: 280,
    resizedWidth: 280,
    usePixelControl: false,
    model: 'qwen-vl-plus-latest',
  });

  // Annotation state
  const [annotationType, setAnnotationType] = useState<AnnotationType>('action_detection');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [annotation, setAnnotation] = useState<AnnotationResponse | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const [currentStageDetail, setCurrentStageDetail] = useState('');

  // Abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const dashScopeServiceRef = useRef<DashScopeService | null>(null);

  // Initialize DashScope service
  if (apiKey && !dashScopeServiceRef.current) {
    dashScopeServiceRef.current = new DashScopeService(apiKey);
  } else if (apiKey && dashScopeServiceRef.current) {
    dashScopeServiceRef.current.updateApiKey(apiKey);
  }

  const uploadVideo = useCallback((file: File | null) => {
    setVideo(file);
    setAnnotation(null);
    setError(null);
    setSuccess(false);
    setProgress(0);
  }, []);

  const updateParameters = useCallback((params: Partial<VideoParameters>) => {
    setParameters((prev) => ({ ...prev, ...params }));
  }, []);

  const selectAnnotationType = useCallback((type: AnnotationType) => {
    setAnnotationType(type);
  }, []);

  const updateCustomPrompt = useCallback((prompt: string) => {
    setCustomPrompt(prompt);
  }, []);

  const updateProgress = (value: number, stage: string, detail: string) => {
    setProgress(value);
    setCurrentStage(stage);
    setCurrentStageDetail(detail);
  };

  const startAnnotation = useCallback(async () => {
    if (!video || !apiKey || !dashScopeServiceRef.current) {
      setError({
        message: !video
          ? 'Пожалуйста, загрузите видео'
          : !apiKey
          ? 'Пожалуйста, добавьте API ключ'
          : 'Сервис не инициализирован',
      });
      return;
    }

    // Get video duration
    const videoElement = document.createElement('video');
    videoElement.src = URL.createObjectURL(video);
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = resolve;
    });
    const videoDuration = videoElement.duration;
    URL.revokeObjectURL(videoElement.src);

    // Validate parameters
    const validation = validateParameters(
      parameters.fps,
      [parameters.resizedHeight, parameters.resizedWidth],
      videoDuration
    );

    if (!validation.valid) {
      setError({ message: validation.errors.join('. ') });
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setAnnotation(null);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      // Stage 1: Prepare video
      updateProgress(10, 'Подготовка', 'Инициализация обработки...');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stage 2: Load video
      updateProgress(20, 'Загрузка видео', 'Загрузка видео в память...');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stage 3: Sample frames
      updateProgress(40, 'Семплирование кадров', `Извлечение кадров с ${parameters.fps} FPS...`);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get prompt
      let prompt: string;
      if (annotationType === 'custom') {
        prompt = customPrompt || 'Опиши что происходит в видео';
      } else {
        prompt = ANNOTATION_PROMPTS[annotationType].prompt;
      }

      // Debug log what we're sending
      console.log('Sending annotation request with:', {
        annotationType,
        fps: parameters.fps,
        resolution: [parameters.resizedHeight, parameters.resizedWidth],
        model: parameters.model,
        usePixelControl: parameters.usePixelControl,
        videoDuration,
        promptType: annotationType === 'custom' ? 'custom' : annotationType,
      });

      // Stage 4: Send to API
      updateProgress(60, 'Отправка в API', 'Отправка данных в DashScope API...');

      // Stage 5: Process with model
      updateProgress(80, 'Анализ модели', 'Qwen3-VL обрабатывает видео...');

      const result = await dashScopeServiceRef.current.annotateVideo({
        videoPath: video,
        fps: parameters.fps,
        resizedHeight: parameters.resizedHeight,
        resizedWidth: parameters.resizedWidth,
        prompt,
        model: parameters.model,
        usePixelControl: parameters.usePixelControl,
        minPixels: parameters.minPixels,
        maxPixels: parameters.maxPixels,
        totalPixels: parameters.totalPixels,
      });

      // Stage 6: Parse result
      updateProgress(90, 'Парсинг результата', 'Обработка ответа модели...');
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Stage 7: Complete
      updateProgress(100, 'Завершено', 'Обработка завершена успешно!');

      setAnnotation(result);
      setSuccess(true);

      // Clear progress after a delay
      setTimeout(() => {
        setProgress(0);
        setCurrentStage('');
        setCurrentStageDetail('');
      }, 2000);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError({ message: 'Обработка отменена пользователем' });
      } else {
        setError({
          message: err.message || 'Произошла ошибка при обработке видео',
          code: err.code,
        });
      }
      setSuccess(false);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, [video, apiKey, parameters, annotationType, customPrompt]);

  const cancelAnnotation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setProgress(0);
    setCurrentStage('');
    setCurrentStageDetail('');
    setError({ message: 'Обработка отменена' });
  }, []);

  const resetAnnotation = useCallback(() => {
    setAnnotation(null);
    setError(null);
    setSuccess(false);
    setProgress(0);
    setCurrentStage('');
    setCurrentStageDetail('');
  }, []);

  const retryAnnotation = useCallback(() => {
    resetAnnotation();
    startAnnotation();
  }, [resetAnnotation, startAnnotation]);

  return {
    // State
    video,
    videoRef,
    parameters,
    annotationType,
    customPrompt,
    annotation,
    isProcessing,
    error,
    success,
    progress,
    currentStage,
    currentStageDetail,

    // Actions
    uploadVideo,
    updateParameters,
    selectAnnotationType,
    updateCustomPrompt,
    startAnnotation,
    cancelAnnotation,
    resetAnnotation,
    retryAnnotation,
  };
}