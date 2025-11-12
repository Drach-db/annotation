import React from 'react';
import './ProcessingStatus.css';

interface ProcessingStatusProps {
  isProcessing: boolean;
  progress: number;
  currentStage?: string;
  currentStageDetail?: string;
  error?: { message: string; code?: string } | null;
  success?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
}

const processingStages: Record<number, { stage: string; detail: string }> = {
  0: { stage: 'Подготовка', detail: 'Инициализация обработки...' },
  20: { stage: 'Загрузка видео', detail: 'Загрузка видео в память...' },
  40: { stage: 'Семплирование кадров', detail: 'Извлечение кадров с заданным FPS...' },
  60: { stage: 'Отправка в API', detail: 'Отправка данных в DashScope API...' },
  80: { stage: 'Анализ модели', detail: 'Qwen3-VL обрабатывает видео...' },
  90: { stage: 'Парсинг результата', detail: 'Обработка ответа модели...' },
  100: { stage: 'Завершено', detail: 'Обработка завершена успешно!' },
};

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  isProcessing,
  progress,
  currentStage,
  currentStageDetail,
  error,
  success,
  onCancel,
  onRetry,
}) => {
  const getStageInfo = () => {
    if (currentStage && currentStageDetail) {
      return { stage: currentStage, detail: currentStageDetail };
    }

    // Find the appropriate stage based on progress
    const stages = Object.keys(processingStages)
      .map(Number)
      .sort((a, b) => b - a);

    for (const stageProgress of stages) {
      if (progress >= stageProgress) {
        return processingStages[stageProgress];
      }
    }

    return processingStages[0];
  };

  const stageInfo = getStageInfo();
  const progressPercentage = Math.min(Math.max(progress, 0), 100);

  if (!isProcessing && !error && !success) {
    return null;
  }

  return (
    <div className="processing-status">
      {isProcessing && (
        <div className="processing-container">
          <div className="progress-section">
            <div className="progress-header">
              <h4>Обработка видео</h4>
              {onCancel && (
                <button
                  className="cancel-btn ghost"
                  onClick={onCancel}
                  title="Отменить обработку"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="progress-bar-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                >
                  <span className="progress-glow" />
                </div>
              </div>
              <span className="progress-percentage">{Math.round(progressPercentage)}%</span>
            </div>

            <div className="status-info">
              <div className="stage-name">
                <span className="stage-indicator" />
                {stageInfo.stage}
              </div>
              <p className="stage-detail">{stageInfo.detail}</p>
            </div>

            {progress > 60 && progress < 90 && (
              <div className="processing-tip">
                <span className="tip-icon">💡</span>
                <span className="tip-text">
                  Модель анализирует видео. Это может занять несколько секунд...
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="error-container">
          <div className="error-header">
            <span className="error-icon">❌</span>
            <h4>Ошибка обработки</h4>
          </div>
          <div className="error-content">
            <p className="error-message">{error.message}</p>
            {error.code && (
              <p className="error-code">Код ошибки: {error.code}</p>
            )}
          </div>
          <div className="error-actions">
            {onRetry && (
              <button className="retry-btn primary" onClick={onRetry}>
                Повторить
              </button>
            )}
            <details className="error-details">
              <summary>Возможные решения</summary>
              <ul>
                <li>Проверьте API ключ DashScope</li>
                <li>Убедитесь, что видео соответствует требованиям</li>
                <li>Попробуйте уменьшить параметры обработки</li>
                <li>Проверьте подключение к интернету</li>
              </ul>
            </details>
          </div>
        </div>
      )}

      {success && (
        <div className="success-container">
          <div className="success-header">
            <span className="success-icon">✅</span>
            <h4>Обработка завершена</h4>
          </div>
          <p className="success-message">
            Видео успешно обработано! Результаты аннотации доступны ниже.
          </p>
          <div className="success-animation">
            <span className="success-circle" />
            <span className="success-circle-2" />
            <span className="success-circle-3" />
          </div>
        </div>
      )}
    </div>
  );
};