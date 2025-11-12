import React, { useState, useRef, useMemo } from 'react';
import './AnnotationOutput.css';

interface AnnotationData {
  content: string;
  usedTokens: number;
  processingTime: number;
  model: string;
  processedFrames?: number;
}

interface AnnotationOutputProps {
  annotation: AnnotationData | null;
  video: File | null;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

interface JsonNode {
  [key: string]: any;
}

export const AnnotationOutput: React.FC<AnnotationOutputProps> = ({
  annotation,
  video,
  videoRef,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copySuccess, setCopySuccess] = useState(false);

  const { isJSON, parsedContent, formattedContent } = useMemo(() => {
    if (!annotation?.content) {
      return { isJSON: false, parsedContent: null, formattedContent: '' };
    }

    try {
      const parsed = JSON.parse(annotation.content);
      return {
        isJSON: true,
        parsedContent: parsed,
        formattedContent: JSON.stringify(parsed, null, 2),
      };
    } catch {
      return {
        isJSON: false,
        parsedContent: null,
        formattedContent: annotation.content,
      };
    }
  }, [annotation?.content]);

  const handleTimestampClick = (timestamp: string) => {
    if (!videoRef?.current) return;

    // Parse timestamp format "MM:SS" or "0:02"
    const parts = timestamp.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      const totalSeconds = minutes * 60 + seconds;

      videoRef.current.currentTime = totalSeconds;
      videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      videoRef.current.play();
    }
  };

  const copyToClipboard = async () => {
    if (!annotation) return;

    try {
      await navigator.clipboard.writeText(formattedContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const exportAsJSON = () => {
    if (!annotation) return;

    const dataToExport = isJSON ? parsedContent : { content: annotation.content };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotation_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsText = () => {
    if (!annotation) return;

    const blob = new Blob([formattedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotation_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleCollapse = (path: string) => {
    setCollapsed((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const renderJSON = (data: JsonNode, path: string = ''): JSX.Element => {
    if (data === null) {
      return <span className="json-null">null</span>;
    }

    if (typeof data === 'boolean') {
      return <span className="json-boolean">{String(data)}</span>;
    }

    if (typeof data === 'number') {
      return <span className="json-number">{data}</span>;
    }

    if (typeof data === 'string') {
      // Check if it's a timestamp
      if (data.match(/^\d+:\d+$/)) {
        return (
          <span
            className="json-string timestamp"
            onClick={() => handleTimestampClick(data)}
            title="Click to jump to this time in video"
          >
            "{data}"
          </span>
        );
      }
      return <span className="json-string">"{data}"</span>;
    }

    if (Array.isArray(data)) {
      const isCollapsed = collapsed[path];
      const itemCount = data.length;

      return (
        <span className="json-array">
          <span
            className="json-toggle"
            onClick={() => toggleCollapse(path)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            [{isCollapsed ? '...' : ''}
          </span>
          {!isCollapsed && (
            <>
              {data.map((item, index) => (
                <div key={index} className="json-item">
                  <span className="json-index">{index}:</span>
                  {renderJSON(item, `${path}[${index}]`)}
                  {index < data.length - 1 && ','}
                </div>
              ))}
            </>
          )}
          <span className="json-bracket">]</span>
          {isCollapsed && <span className="json-count"> ({itemCount} items)</span>}
        </span>
      );
    }

    if (typeof data === 'object') {
      const isCollapsed = collapsed[path];
      const keys = Object.keys(data);

      return (
        <span className="json-object">
          <span
            className="json-toggle"
            onClick={() => toggleCollapse(path)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {'{'}
            {isCollapsed ? '...' : ''}
          </span>
          {!isCollapsed && (
            <>
              {keys.map((key, index) => (
                <div key={key} className="json-property">
                  <span className="json-key">"{key}":</span>
                  {renderJSON(data[key], `${path}.${key}`)}
                  {index < keys.length - 1 && ','}
                </div>
              ))}
            </>
          )}
          <span className="json-bracket">{'}'}</span>
          {isCollapsed && <span className="json-count"> ({keys.length} props)</span>}
        </span>
      );
    }

    return <span>{String(data)}</span>;
  };

  const renderMarkdown = (text: string): JSX.Element => {
    // Simple markdown-like rendering with timestamp detection
    const lines = text.split('\n');

    return (
      <div className="markdown-output">
        {lines.map((line, index) => {
          // Check for timestamps in the line
          const timestampRegex = /(\d+:\d+)/g;
          const parts = line.split(timestampRegex);

          return (
            <div key={index} className="markdown-line">
              {parts.map((part, partIndex) => {
                if (part.match(/^\d+:\d+$/)) {
                  return (
                    <span
                      key={partIndex}
                      className="timestamp"
                      onClick={() => handleTimestampClick(part)}
                      title="Click to jump to this time in video"
                    >
                      {part}
                    </span>
                  );
                }
                return <span key={partIndex}>{part}</span>;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  if (!annotation) {
    return null;
  }

  return (
    <div className="annotation-output">
      <div className="output-header">
        <h3>Результат аннотации</h3>
        <div className="output-actions">
          <button
            className={`action-btn ghost ${copySuccess ? 'success' : ''}`}
            onClick={copyToClipboard}
            title="Копировать в буфер обмена"
          >
            {copySuccess ? '✓ Скопировано' : '📋 Копировать'}
          </button>
          <button
            className="action-btn ghost"
            onClick={exportAsJSON}
            title="Экспорт как JSON"
          >
            💾 JSON
          </button>
          <button
            className="action-btn ghost"
            onClick={exportAsText}
            title="Экспорт как текст"
          >
            📄 TXT
          </button>
        </div>
      </div>

      <div className="output-content">
        {isJSON ? (
          <div className="json-viewer">
            {renderJSON(parsedContent)}
          </div>
        ) : (
          renderMarkdown(formattedContent)
        )}
      </div>

      <div className="output-metadata">
        <div className="metadata-item">
          <span className="metadata-label">Модель:</span>
          <span className="metadata-value">{annotation.model}</span>
        </div>
        {annotation.processedFrames && (
          <div className="metadata-item">
            <span className="metadata-label">Обработано кадров:</span>
            <span className="metadata-value">{annotation.processedFrames}</span>
          </div>
        )}
        <div className="metadata-item">
          <span className="metadata-label">Время обработки:</span>
          <span className="metadata-value">{annotation.processingTime.toFixed(2)}s</span>
        </div>
        <div className="metadata-item">
          <span className="metadata-label">Использовано токенов:</span>
          <span className="metadata-value">{annotation.usedTokens.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};