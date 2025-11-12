import React, { useState, useEffect } from 'react';
import { VideoUploader } from './components/VideoUploader';
import { ParametersPanel } from './components/ParametersPanel';
import { PromptSelector } from './components/PromptSelector';
import { ProcessingStatus } from './components/ProcessingStatus';
import { AnnotationOutput } from './components/AnnotationOutput';
import { useVideoAnnotation } from './hooks/useVideoAnnotation';
import './App.css';

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('dashscope_api_key') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(!apiKey);
  const [tempApiKey, setTempApiKey] = useState('');
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);

  const {
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
    uploadVideo,
    updateParameters,
    selectAnnotationType,
    updateCustomPrompt,
    startAnnotation,
    cancelAnnotation,
    retryAnnotation,
  } = useVideoAnnotation(apiKey);

  useEffect(() => {
    // Check if API key exists on mount
    if (!apiKey) {
      setShowApiKeyModal(true);
    }
  }, []);

  const handleApiKeySubmit = () => {
    if (tempApiKey.trim()) {
      localStorage.setItem('dashscope_api_key', tempApiKey);
      setApiKey(tempApiKey);
      setShowApiKeyModal(false);
      setTempApiKey('');
    }
  };

  const handleApiKeyChange = () => {
    setTempApiKey(apiKey);
    setShowApiKeyModal(true);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Video Annotation Studio</h1>
            <p className="subtitle">Аннотация видео с Qwen3-VL для тренировки роботов</p>
          </div>
          <button
            className="api-key-btn secondary"
            onClick={handleApiKeyChange}
          >
            {apiKey ? 'Изменить API ключ' : 'Добавить API ключ'}
          </button>
        </div>
      </header>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="modal-overlay" onClick={() => setShowApiKeyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>DashScope API Key</h3>
            <p className="modal-description">
              Введите ваш API ключ от DashScope для использования Qwen3-VL модели.
              Ключ будет сохранен локально в браузере.
            </p>
            <input
              type="password"
              placeholder="sk-..."
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleApiKeySubmit();
                }
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => {
                  setShowApiKeyModal(false);
                  setTempApiKey('');
                }}
              >
                Отмена
              </button>
              <button
                className="primary"
                onClick={handleApiKeySubmit}
                disabled={!tempApiKey.trim()}
              >
                Сохранить
              </button>
            </div>
            <div className="modal-footer">
              <small>
                Получить API ключ можно на{' '}
                <a
                  href="https://dashscope.console.aliyun.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  DashScope Console
                </a>
              </small>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="app-main">
        {/* Left Panel */}
        <div className="left-panel">
          <VideoUploader
            video={video}
            onVideoUpload={uploadVideo}
            onVideoDurationChange={setVideoDuration}
          />

          <ParametersPanel
            parameters={parameters}
            videoDuration={videoDuration}
            onParametersChange={updateParameters}
          />

          <PromptSelector
            selectedType={annotationType}
            customPrompt={customPrompt}
            onTypeSelect={selectAnnotationType}
            onPromptChange={updateCustomPrompt}
          />

          <button
            className="start-annotation-btn primary"
            disabled={!video || !apiKey || isProcessing}
            onClick={startAnnotation}
          >
            {isProcessing ? (
              <>
                <span className="spinner" />
                Обработка...
              </>
            ) : (
              <>
                🚀 Начать аннотацию
              </>
            )}
          </button>
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          <ProcessingStatus
            isProcessing={isProcessing}
            progress={progress}
            currentStage={currentStage}
            currentStageDetail={currentStageDetail}
            error={error}
            success={success}
            onCancel={cancelAnnotation}
            onRetry={retryAnnotation}
          />

          {annotation && (
            <AnnotationOutput
              annotation={annotation}
              video={video}
              videoRef={videoRef}
            />
          )}

          {!annotation && !isProcessing && !error && !success && (
            <div className="empty-state">
              <div className="empty-state-content">
                <svg
                  className="empty-icon"
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 11L12 14L22 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 12V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3>Готов к работе</h3>
                <p>
                  Загрузите видео, настройте параметры и начните аннотацию
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          Powered by Qwen3-VL · DashScope API · Built with React + TypeScript
        </p>
      </footer>
    </div>
  );
}

export default App;