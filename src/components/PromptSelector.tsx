import React, { useState, useEffect } from 'react';
import './PromptSelector.css';

export type AnnotationType =
  | 'action_detection'
  | 'object_tracking'
  | 'spatial_reasoning'
  | 'task_completion'
  | 'custom';

interface PromptConfig {
  name: string;
  description: string;
  prompt: string;
  icon?: string;
}

interface PromptSelectorProps {
  selectedType: AnnotationType;
  customPrompt: string;
  onTypeSelect: (type: AnnotationType) => void;
  onPromptChange: (prompt: string) => void;
}

export const ANNOTATION_PROMPTS: Record<Exclude<AnnotationType, 'custom'>, PromptConfig> = {
  action_detection: {
    name: 'Детекция действий',
    description: 'Определяет действия робота: хватание, перемещение, отпускание',
    icon: '🤖',
    prompt: `Проанализируй действия робота в видео и опиши:
1. Какие объекты робот берёт или перемещает
2. Какие движения выполняет (хватание, перемещение, отпускание)
3. Временные метки для каждого действия (примерно)
4. Успешность выполнения задачи

Формат ответа: JSON со структурой {
    "actions": [
        {"timestamp": "0:02", "action": "grasp", "object": "cup", "success": true},
        ...
    ],
    "summary": "Краткое описание выполненных действий"
}`,
  },

  object_tracking: {
    name: 'Отслеживание объектов',
    description: 'Отслеживает объекты и их взаимодействие с роботом',
    icon: '📍',
    prompt: `Отследи все объекты, с которыми взаимодействует робот:

1. Определи и перечисли все объекты в сцене
2. Опиши начальное положение каждого объекта
3. Отследи изменения положения во времени
4. Определи тип взаимодействия робота с каждым объектом

Формат ответа: JSON со структурой {
    "objects": [
        {
            "id": "object_1",
            "type": "cup",
            "initial_position": "слева на столе",
            "final_position": "справа на столе",
            "interactions": [
                {"timestamp": "0:03", "interaction": "grasped"},
                {"timestamp": "0:05", "interaction": "moved"},
                {"timestamp": "0:07", "interaction": "released"}
            ]
        }
    ],
    "total_objects": 3,
    "manipulated_objects": 1
}`,
  },

  spatial_reasoning: {
    name: 'Пространственное понимание',
    description: 'Анализирует пространственные отношения в сцене',
    icon: '📐',
    prompt: `Опиши пространственные отношения в сцене:

1. Где находится робот относительно объектов
2. Какова траектория движения манипулятора
3. Какие препятствия есть в сцене и как робот их избегает
4. Оцени точность позиционирования робота

Включи в анализ:
- Начальная конфигурация сцены
- Ключевые пространственные изменения
- Оценка навигации и планирования пути
- Возможные улучшения траектории

Формат ответа: структурированный текст с разделами`,
  },

  task_completion: {
    name: 'Оценка выполнения задачи',
    description: 'Оценивает успешность выполнения задачи роботом',
    icon: '✅',
    prompt: `Оцени выполнение задачи роботом:

1. Определи цель задачи (что робот пытается сделать)
2. Была ли задача выполнена успешно
3. Какие ошибки или неточности были допущены
4. Сколько времени заняло выполнение
5. Эффективность движений робота

Формат ответа: JSON со структурой {
    "task_goal": "описание цели",
    "success": true/false,
    "completion_percentage": 95,
    "duration_seconds": 12,
    "errors": ["список ошибок"],
    "efficiency_score": 8.5,
    "suggestions": ["предложения по улучшению"]
}`,
  },
};

export const PromptSelector: React.FC<PromptSelectorProps> = ({
  selectedType,
  customPrompt,
  onTypeSelect,
  onPromptChange,
}) => {
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (selectedType === 'custom') {
      setCurrentPrompt(customPrompt);
    } else {
      setCurrentPrompt(ANNOTATION_PROMPTS[selectedType].prompt);
    }
  }, [selectedType, customPrompt]);

  const handleTypeSelect = (type: AnnotationType) => {
    onTypeSelect(type);
    setIsEditing(false);
  };

  const handlePromptEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setCurrentPrompt(newPrompt);
    onPromptChange(newPrompt);

    // Если пользователь редактирует промпт, переключаем на custom
    if (selectedType !== 'custom' && newPrompt !== ANNOTATION_PROMPTS[selectedType]?.prompt) {
      onTypeSelect('custom');
    }
  };

  const resetToDefault = () => {
    if (selectedType !== 'custom' && ANNOTATION_PROMPTS[selectedType]) {
      const defaultPrompt = ANNOTATION_PROMPTS[selectedType].prompt;
      setCurrentPrompt(defaultPrompt);
      onPromptChange(defaultPrompt);
    }
  };

  // Debug log
  console.log('PromptSelector rendering with:', { selectedType, customPrompt });

  return (
    <div className="prompt-selector">
      <h3 className="selector-title">Тип аннотации</h3>

      {/* Prompt Type Cards */}
      <div className="prompt-types">
        {Object.entries(ANNOTATION_PROMPTS).map(([key, config]) => (
          <div
            key={key}
            className={`prompt-card ${selectedType === key ? 'active' : ''}`}
            onClick={() => handleTypeSelect(key as AnnotationType)}
          >
            {config.icon && <span className="prompt-icon">{config.icon}</span>}
            <div className="prompt-info">
              <h4 className="prompt-name">{config.name}</h4>
              <p className="prompt-description">{config.description}</p>
            </div>
          </div>
        ))}

        {/* Custom Prompt Card */}
        <div
          className={`prompt-card ${selectedType === 'custom' ? 'active' : ''}`}
          onClick={() => handleTypeSelect('custom')}
        >
          <span className="prompt-icon">✏️</span>
          <div className="prompt-info">
            <h4 className="prompt-name">Кастомный промпт</h4>
            <p className="prompt-description">Напишите свой собственный промпт</p>
          </div>
        </div>
      </div>

      {/* Prompt Preview/Editor */}
      <div className="prompt-preview">
        <div className="preview-header">
          <h4>Промпт для модели</h4>
          <div className="preview-actions">
            {selectedType !== 'custom' && currentPrompt !== ANNOTATION_PROMPTS[selectedType]?.prompt && (
              <button
                className="reset-btn ghost"
                onClick={resetToDefault}
                title="Сбросить к оригинальному промпту"
              >
                Сбросить
              </button>
            )}
            <button
              className={`edit-btn ghost ${isEditing ? 'active' : ''}`}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Просмотр' : 'Редактировать'}
            </button>
          </div>
        </div>

        {isEditing ? (
          <textarea
            className="prompt-editor"
            value={currentPrompt}
            onChange={handlePromptEdit}
            rows={12}
            placeholder="Введите промпт для анализа видео..."
            spellCheck={false}
          />
        ) : (
          <pre className="prompt-display">{currentPrompt}</pre>
        )}

        <div className="prompt-tips">
          <h5>Советы по написанию промптов:</h5>
          <ul>
            <li>Будьте конкретны в том, что хотите получить</li>
            <li>Укажите желаемый формат ответа (JSON, список, текст)</li>
            <li>Включите примеры, если нужен определенный формат</li>
            <li>Используйте временные метки для синхронизации с видео</li>
          </ul>
        </div>
      </div>
    </div>
  );
};