import React, { useState, useEffect } from 'react';
import './ParametersPanel.css';

export interface VideoParameters {
  fps: number;
  resizedHeight: number;
  resizedWidth: number;
  usePixelControl: boolean;
  minPixels?: number;
  maxPixels?: number;
  totalPixels?: number;
  model: 'qwen-vl-plus-latest' | 'qwen-vl-max';
}

interface ParametersPanelProps {
  parameters: VideoParameters;
  videoDuration?: number;
  onParametersChange: (params: Partial<VideoParameters>) => void;
}

interface TokenEstimate {
  estimatedFrames: number;
  tokensPerFrame: number;
  totalTokens: number;
  isOptimal: boolean;
}

const presets = {
  fast: {
    name: 'Быстрая обработка',
    description: '2 fps, 224×224',
    params: { fps: 2, resizedHeight: 224, resizedWidth: 224 },
  },
  balanced: {
    name: 'Сбалансированная',
    description: '2 fps, 280×280',
    params: { fps: 2, resizedHeight: 280, resizedWidth: 280 },
  },
  detailed: {
    name: 'Детальная',
    description: '4 fps, 360×360',
    params: { fps: 4, resizedHeight: 360, resizedWidth: 360 },
  },
};

export const ParametersPanel: React.FC<ParametersPanelProps> = ({
  parameters,
  videoDuration = 0,
  onParametersChange,
}) => {
  const [tokenEstimate, setTokenEstimate] = useState<TokenEstimate>({
    estimatedFrames: 0,
    tokensPerFrame: 0,
    totalTokens: 0,
    isOptimal: true,
  });

  const calculateTokens = () => {
    if (!videoDuration) {
      return {
        estimatedFrames: 0,
        tokensPerFrame: 0,
        totalTokens: 0,
        isOptimal: true,
      };
    }

    const frames = Math.floor(videoDuration * parameters.fps);

    // Round to nearest 32
    const h = Math.ceil(parameters.resizedHeight / 32) * 32;
    const w = Math.ceil(parameters.resizedWidth / 32) * 32;

    // Qwen3-VL compression ratio = 32
    const tokensPerFrame = Math.ceil((h * w) / (32 * 32));
    const totalTokens = frames * tokensPerFrame;

    return {
      estimatedFrames: frames,
      tokensPerFrame,
      totalTokens,
      isOptimal: totalTokens <= 16384,
    };
  };

  useEffect(() => {
    setTokenEstimate(calculateTokens());
  }, [parameters, videoDuration]);

  const applyPreset = (presetKey: keyof typeof presets) => {
    const preset = presets[presetKey];
    onParametersChange(preset.params);
  };

  const handleFpsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onParametersChange({ fps: parseFloat(e.target.value) });
  };

  const handleResolutionChange = (dimension: 'height' | 'width', value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      if (dimension === 'height') {
        onParametersChange({ resizedHeight: numValue });
      } else {
        onParametersChange({ resizedWidth: numValue });
      }
    }
  };

  const togglePixelControl = () => {
    onParametersChange({ usePixelControl: !parameters.usePixelControl });
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onParametersChange({ model: e.target.value as VideoParameters['model'] });
  };

  const handlePixelValueChange = (field: 'minPixels' | 'maxPixels' | 'totalPixels', value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      onParametersChange({ [field]: numValue });
    }
  };

  // Debug log
  console.log('ParametersPanel rendering with:', { parameters, videoDuration });

  return (
    <div className="parameters-panel">
      <h3 className="panel-title">Параметры обработки</h3>

      {/* Preset Buttons */}
      <div className="presets">
        <h4>Быстрые настройки</h4>
        <div className="preset-buttons">
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              className="preset-btn secondary"
              onClick={() => applyPreset(key as keyof typeof presets)}
              title={preset.description}
              type="button"
            >
              <span className="preset-name">{preset.name}</span>
              <small className="preset-desc">{preset.description}</small>
            </button>
          ))}
        </div>
      </div>

      {/* Main Parameters */}
      <div className="parameter-group">
        <h4>Основные параметры</h4>

        <div className="parameter-field">
          <label>
            FPS (частота кадров)
            <div className="fps-control">
              <input
                type="range"
                min="0.5"
                max="8"
                step="0.5"
                value={parameters.fps}
                onChange={handleFpsChange}
                className="fps-slider"
              />
              <span className="value-display">{parameters.fps} fps</span>
            </div>
          </label>
          <small className="parameter-hint">
            Больше FPS = больше токенов, но детальнее анализ
          </small>
        </div>

        <div className="parameter-field">
          <label>Разрешение кадра</label>
          <div className="resolution-inputs">
            <input
              type="number"
              value={parameters.resizedHeight}
              min="224"
              max="640"
              step="32"
              onChange={(e) => handleResolutionChange('height', e.target.value)}
              className="resolution-input"
            />
            <span className="resolution-separator">×</span>
            <input
              type="number"
              value={parameters.resizedWidth}
              min="224"
              max="640"
              step="32"
              onChange={(e) => handleResolutionChange('width', e.target.value)}
              className="resolution-input"
            />
          </div>
          <small className="parameter-hint">
            Значения округлятся до кратных 32
          </small>
        </div>

        <div className="parameter-field">
          <label>
            Модель
            <select
              value={parameters.model}
              onChange={handleModelChange}
              className="model-select"
            >
              <option value="qwen-vl-plus-latest">Qwen-VL Plus (быстрее)</option>
              <option value="qwen-vl-max">Qwen-VL Max (точнее)</option>
            </select>
          </label>
          <small className="parameter-hint">
            Max модель дает более точные результаты, но работает медленнее
          </small>
        </div>
      </div>

      {/* Pixel Control Mode */}
      <div className="parameter-group">
        <h4>Дополнительные настройки</h4>

        <div className="parameter-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={parameters.usePixelControl}
              onChange={togglePixelControl}
            />
            Использовать контроль через min/max pixels
          </label>
          <small className="parameter-hint">
            Альтернативный способ контроля качества для длинных видео
          </small>
        </div>

        {parameters.usePixelControl && (
          <>
            <div className="parameter-field">
              <label>
                Min Pixels
                <input
                  type="number"
                  value={parameters.minPixels || 256 * 32 * 32}
                  onChange={(e) => handlePixelValueChange('minPixels', e.target.value)}
                  className="pixel-input"
                />
              </label>
            </div>

            <div className="parameter-field">
              <label>
                Max Pixels
                <input
                  type="number"
                  value={parameters.maxPixels || 1280 * 32 * 32}
                  onChange={(e) => handlePixelValueChange('maxPixels', e.target.value)}
                  className="pixel-input"
                />
              </label>
            </div>

            <div className="parameter-field">
              <label>
                Total Pixels (для длинных видео)
                <input
                  type="number"
                  value={parameters.totalPixels || 0}
                  onChange={(e) => handlePixelValueChange('totalPixels', e.target.value)}
                  className="pixel-input"
                  placeholder="Оставьте пустым для авто"
                />
              </label>
            </div>
          </>
        )}
      </div>

      {/* Token Estimate */}
      <div className="token-estimate">
        <h4>Оценка использования</h4>
        {videoDuration ? (
          <>
            <div className="estimate-row">
              <span className="estimate-label">Длительность видео:</span>
              <strong className="estimate-value">{videoDuration.toFixed(1)}s</strong>
            </div>
            <div className="estimate-row">
              <span className="estimate-label">Количество кадров:</span>
              <strong className="estimate-value">{tokenEstimate.estimatedFrames}</strong>
            </div>
            <div className="estimate-row">
              <span className="estimate-label">Токенов на кадр:</span>
              <strong className="estimate-value">{tokenEstimate.tokensPerFrame}</strong>
            </div>
            <div className="estimate-row">
              <span className="estimate-label">Всего токенов:</span>
              <strong
                className={`estimate-value ${
                  tokenEstimate.isOptimal ? 'success' : 'warning'
                }`}
              >
                {tokenEstimate.totalTokens.toLocaleString()}
                {!tokenEstimate.isOptimal && ' ⚠️'}
              </strong>
            </div>
            {!tokenEstimate.isOptimal && (
              <div className="warning-message">
                <svg
                  className="warning-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  Превышен рекомендуемый лимит (16384 токена).
                  Рекомендуется снизить параметры для оптимальной работы.
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="no-video-message">
            Загрузите видео для расчета токенов
          </div>
        )}
      </div>
    </div>
  );
};