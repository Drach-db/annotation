# Video Annotation with Qwen3-VL

Python backend для аннотации видео с использованием модели Qwen3-VL через DashScope API.

## 🚀 Быстрый старт

1. Перейдите в папку backend:
```bash
cd backend
```

2. Установите зависимости:
```bash
pip install dashscope opencv-python numpy
```

3. Настройте API ключ и параметры в начале файла `annotate_video.py`:
```python
API_KEY = 'ваш-ключ-здесь'
MODEL = 'qwen-vl-max-latest'
FPS = 1.0
```

4. Запустите аннотацию:
```bash
python annotate_video.py videos/ваше_видео.mp4
```

## 📁 Структура

```
annotation/
├── backend/
│   ├── annotate_video.py    # Основной скрипт
│   ├── videos/              # Видео для обработки
│   ├── prompts/             # Промпты
│   └── outputs/             # Результаты
└── README.md
```

Подробная документация в [backend/README.md](backend/README.md)