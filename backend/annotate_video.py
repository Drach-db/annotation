#!/usr/bin/env python3
"""
Скрипт для аннотации видео с помощью Qwen3-VL через DashScope API
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
import dashscope
from dashscope import MultiModalConversation

# =====================================================
# ОСНОВНЫЕ НАСТРОЙКИ - ИЗМЕНИТЕ ЗДЕСЬ
# =====================================================

# API ключ (можно также через переменную окружения DASHSCOPE_API_KEY)
API_KEY = 'sk-476b491113df4f5db020c57d936dd5d6'

# Модель для использования ('qwen-vl-plus-latest' или 'qwen-vl-max-latest')
MODEL = 'qwen-vl-max-latest'

# Параметры обработки видео
FPS = 1.0  # Частота извлечения кадров (0.1 - 10.0)

# Параметры генерации текста
TEMPERATURE = 0.3  # Низкая для точной аннотации (0.0 - 1.0)
MAX_TOKENS = 4000  # Максимум токенов в ответе

# =====================================================

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('annotation.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Настройка API ключа
dashscope.api_key = os.getenv('DASHSCOPE_API_KEY', API_KEY)
logger.info(f"Используется API ключ: {dashscope.api_key[:10]}...")  # Показываем только начало ключа


class VideoAnnotator:
    """Класс для аннотации видео с помощью Qwen3-VL"""

    def __init__(self):
        self.model = MODEL
        self.fps = FPS
        self.temperature = TEMPERATURE
        self.max_tokens = MAX_TOKENS

        # Создаем директории если их нет
        self.base_dir = Path(__file__).parent
        self.videos_dir = self.base_dir / 'videos'
        self.outputs_dir = self.base_dir / 'outputs'
        self.prompts_dir = self.base_dir / 'prompts'

        for dir_path in [self.videos_dir, self.outputs_dir, self.prompts_dir]:
            dir_path.mkdir(exist_ok=True)
            logger.debug(f"Проверена/создана директория: {dir_path}")

    def load_prompt(self, prompt_path=None):
        """Загружает промпт из файла"""
        if prompt_path is None:
            prompt_path = self.prompts_dir / 'pov_annotation_prompt.txt'
        else:
            prompt_path = Path(prompt_path)

        logger.info(f"Загрузка промпта из: {prompt_path}")

        if not prompt_path.exists():
            logger.warning(f"Файл промпта не найден: {prompt_path}")
            return "Проанализируй это видео и опиши действия, которые происходят в нём."

        with open(prompt_path, 'r', encoding='utf-8') as f:
            content = f.read()
            logger.info(f"Промпт загружен, размер: {len(content)} символов")
            return content

    def annotate_video(self, video_path, prompt_text=None):
        """Аннотирует видео используя DashScope API"""
        video_path = Path(video_path)

        logger.info(f"Начало обработки видео: {video_path}")

        if not video_path.exists():
            logger.error(f"Видео не найдено: {video_path}")
            raise FileNotFoundError(f"Видео не найдено: {video_path}")

        # Проверяем размер файла
        file_size = video_path.stat().st_size / (1024 * 1024)  # В мегабайтах
        logger.info(f"Размер видео: {file_size:.2f} MB")

        if file_size > 1000:  # 1 GB
            logger.warning(f"Видео слишком большое ({file_size:.2f} MB). Максимум 1 GB.")

        if prompt_text is None:
            prompt_text = self.load_prompt()

        print(f"\n📹 Обработка видео: {video_path.name}")
        print(f"🤖 Модель: {self.model}")
        print(f"⚙️  FPS: {self.fps}")
        print(f"🌡️  Temperature: {self.temperature}")
        print(f"📝 Длина промпта: {len(prompt_text)} символов")
        print(f"💾 Размер видео: {file_size:.2f} MB")

        # Преобразуем путь в абсолютный путь с file://
        video_url = f"file://{video_path.absolute()}"
        logger.info(f"Видео URL: {video_url}")

        # Формируем сообщение для API (как в cookbook)
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "video",
                        "video": video_url,
                        "fps": self.fps
                    },
                    {
                        "type": "text",
                        "text": prompt_text
                    }
                ]
            }
        ]

        logger.debug(f"Сформированы messages для API, fps={self.fps}")

        print("\n⏳ Отправка запроса в DashScope API...")
        logger.info("Отправка запроса в DashScope API...")
        start_time = datetime.now()

        try:
            # Вызываем API
            logger.debug(f"Вызов API с параметрами: model={self.model}, temp={self.temperature}, max_tokens={self.max_tokens}")

            response = MultiModalConversation.call(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                top_p=0.9
            )

            processing_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"Получен ответ от API за {processing_time:.1f} секунд")

            if response.status_code != 200:
                logger.error(f"Ошибка API: код {response.status_code}, сообщение: {response.message}")
                raise Exception(f"Ошибка API: {response.message}")

            # Извлекаем результат
            content = response.output.choices[0].message.content
            logger.info(f"Размер аннотации: {len(content)} символов")

            print(f"✅ Обработка завершена за {processing_time:.1f} секунд")

            return {
                'content': content,
                'processing_time': processing_time,
                'model': self.model,
                'fps': self.fps
            }

        except Exception as e:
            logger.error(f"Ошибка при обработке: {e}", exc_info=True)
            print(f"❌ Ошибка при обработке: {e}")
            raise

    def save_results(self, video_name, result):
        """Сохраняет результаты аннотации"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"{Path(video_name).stem}_{timestamp}"

        logger.info(f"Сохранение результатов для {video_name}")

        # Сохраняем JSON
        json_path = self.outputs_dir / f"{base_name}.json"
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump({
                    'video': video_name,
                    'model': result['model'],
                    'fps': result['fps'],
                    'processing_time': result['processing_time'],
                    'timestamp': timestamp,
                    'annotation': result['content']
                }, f, ensure_ascii=False, indent=2)
            logger.info(f"JSON сохранен: {json_path}")
        except Exception as e:
            logger.error(f"Ошибка сохранения JSON: {e}")

        # Сохраняем текстовую версию
        txt_path = self.outputs_dir / f"{base_name}.txt"
        try:
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(f"=== Аннотация видео: {video_name} ===\n")
                f.write(f"Модель: {result['model']}\n")
                f.write(f"FPS: {result['fps']}\n")
                f.write(f"Время обработки: {result['processing_time']:.1f} сек\n")
                f.write(f"Дата: {timestamp}\n")
                f.write(f"\n--- Аннотация ---\n")
                f.write(result['content'])
            logger.info(f"TXT сохранен: {txt_path}")
        except Exception as e:
            logger.error(f"Ошибка сохранения TXT: {e}")

        print(f"\n💾 Результаты сохранены:")
        print(f"   • JSON: {json_path}")
        print(f"   • TXT:  {txt_path}")

        return json_path, txt_path


def main():
    parser = argparse.ArgumentParser(description='Аннотация видео с помощью Qwen3-VL')
    parser.add_argument('video', help='Путь к видео файлу')
    parser.add_argument('--prompt', help='Путь к файлу с промптом')
    parser.add_argument('--fps', type=float, help=f'FPS для извлечения кадров (по умолчанию: {FPS})')
    parser.add_argument('--model', help=f'Модель для использования (по умолчанию: {MODEL})')
    parser.add_argument('--temperature', type=float, help=f'Temperature для генерации (по умолчанию: {TEMPERATURE})')

    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Запуск скрипта аннотации видео")
    logger.info(f"Видео: {args.video}")
    logger.info(f"Параметры командной строки: fps={args.fps}, model={args.model}, temp={args.temperature}")

    # Создаем аннотатор
    annotator = VideoAnnotator()

    # Применяем параметры из командной строки если указаны
    if args.fps:
        annotator.fps = args.fps
        logger.info(f"FPS изменен на {args.fps}")
    if args.model:
        annotator.model = args.model
        logger.info(f"Модель изменена на {args.model}")
    if args.temperature:
        annotator.temperature = args.temperature
        logger.info(f"Temperature изменена на {args.temperature}")

    # Загружаем промпт
    prompt = None
    if args.prompt:
        logger.info(f"Загрузка кастомного промпта из {args.prompt}")
        with open(args.prompt, 'r', encoding='utf-8') as f:
            prompt = f.read()

    try:
        # Аннотируем видео
        result = annotator.annotate_video(args.video, prompt)

        # Сохраняем результаты
        annotator.save_results(Path(args.video).name, result)

        # Выводим часть результата
        print(f"\n📄 Первые 500 символов аннотации:")
        print("-" * 50)
        print(result['content'][:500])
        if len(result['content']) > 500:
            print("...")

        logger.info("Скрипт завершен успешно")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Критическая ошибка: {e}", exc_info=True)
        print(f"\n❌ Ошибка: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()