import axios, { AxiosInstance } from 'axios';

export interface DashScopeConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  region: 'international' | 'china';
}

export interface AnnotationRequest {
  videoPath: string | File;
  fps: number;
  resizedHeight: number;
  resizedWidth: number;
  prompt: string;
  model: string;
  usePixelControl?: boolean;
  minPixels?: number;
  maxPixels?: number;
  totalPixels?: number;
}

export interface AnnotationResponse {
  content: string;
  usedTokens: number;
  processingTime: number;
  model: string;
  processedFrames?: number;
}

interface DashScopeAPIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export class DashScopeService {
  private config: DashScopeConfig;
  private axiosInstance: AxiosInstance;

  constructor(apiKey: string, region: 'international' | 'china' = 'international') {
    this.config = {
      apiKey,
      baseURL:
        region === 'international'
          ? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
          : 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-vl-plus-latest',
      region,
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minutes timeout
    });
  }

  async annotateVideo(request: AnnotationRequest, onProgress?: (stage: string, detail: string) => void): Promise<AnnotationResponse> {
    const startTime = Date.now();

    // Debug logging
    console.log('DashScope API Request:', {
      model: request.model,
      fps: request.fps,
      resolution: `${request.resizedHeight}x${request.resizedWidth}`,
      usePixelControl: request.usePixelControl,
      pixelParams: {
        minPixels: request.minPixels,
        maxPixels: request.maxPixels,
        totalPixels: request.totalPixels
      },
      promptLength: request.prompt.length
    });

    try {
      // Convert video file to base64 if it's a File object
      let videoData = request.videoPath;
      if (request.videoPath instanceof File) {
        // Check file size before conversion
        const fileSizeMB = request.videoPath.size / (1024 * 1024);
        console.log(`Converting video to base64... File size: ${fileSizeMB.toFixed(2)}MB`);

        if (fileSizeMB > 10) {
          console.warn('Large video file detected. This may take longer to process.');
        }

        if (onProgress) {
          onProgress('Конвертация видео', `Подготовка ${fileSizeMB.toFixed(1)}MB для отправки...`);
        }

        videoData = await this.fileToBase64WithProgress(request.videoPath, (progress) => {
          if (onProgress) {
            onProgress('Конвертация видео', `Обработано ${Math.round(progress)}%`);
          }
        });
        console.log('Video converted to base64 successfully');
      }

      // Prepare the video content parameters
      const videoContent: any = {
        type: 'video',
        video: videoData,
        fps: request.fps,
      };

      // Add resolution parameters based on pixel control mode
      if (request.usePixelControl) {
        if (request.minPixels) videoContent.min_pixels = request.minPixels;
        if (request.maxPixels) videoContent.max_pixels = request.maxPixels;
        if (request.totalPixels) videoContent.total_pixels = request.totalPixels;
      } else {
        videoContent.resized_height = request.resizedHeight;
        videoContent.resized_width = request.resizedWidth;
      }

      // Calculate estimated frames for metadata
      // Note: We should pass actual video duration from the hook for accurate calculation
      const estimatedFrames = Math.floor(30 * request.fps); // TODO: Use actual video duration

      // Debug log final video content parameters
      console.log('Final video content params:', {
        type: videoContent.type,
        fps: videoContent.fps,
        resized_height: videoContent.resized_height,
        resized_width: videoContent.resized_width,
        min_pixels: videoContent.min_pixels,
        max_pixels: videoContent.max_pixels,
        total_pixels: videoContent.total_pixels,
        hasVideo: !!videoContent.video
      });

      const response = await this.axiosInstance.post<DashScopeAPIResponse>(
        '/chat/completions',
        {
          model: request.model,
          messages: [
            {
              role: 'user',
              content: [
                videoContent,
                {
                  type: 'text',
                  text: request.prompt,
                },
              ],
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
          top_p: 0.9,
        }
      );

      const endTime = Date.now();

      if (!response.data.choices || response.data.choices.length === 0) {
        throw new Error('No response from the model');
      }

      return {
        content: response.data.choices[0].message.content,
        usedTokens: response.data.usage?.total_tokens || 0,
        processingTime: (endTime - startTime) / 1000,
        model: request.model,
        processedFrames: estimatedFrames,
      };
    } catch (error: any) {
      if (error.response) {
        // API error response
        const errorMessage =
          error.response.data?.error?.message ||
          error.response.data?.message ||
          'DashScope API error';
        const errorCode = error.response.data?.error?.code || error.response.status;

        throw new Error(`API Error (${errorCode}): ${errorMessage}`);
      } else if (error.request) {
        // Network error
        throw new Error('Network error: Unable to reach DashScope API');
      } else {
        // Other errors
        throw new Error(`Processing error: ${error.message}`);
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/models');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await this.axiosInstance.get('/models');
      return response.data.data
        .filter((model: any) => model.id.includes('qwen-vl'))
        .map((model: any) => model.id);
    } catch {
      return ['qwen-vl-plus-latest', 'qwen-vl-max'];
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // DashScope API expects full data URL format for videos
          // Format: data:video/mp4;base64,xxxxx
          resolve(reader.result); // Return full data URL, not just base64
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  }

  private async fileToBase64WithProgress(file: File, onProgress?: (progress: number) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      if (onProgress) {
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        };
      }

      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  }

  updateApiKey(newApiKey: string) {
    this.config.apiKey = newApiKey;
    this.axiosInstance.defaults.headers['Authorization'] = `Bearer ${newApiKey}`;
  }

  updateRegion(region: 'international' | 'china') {
    this.config.region = region;
    this.config.baseURL =
      region === 'international'
        ? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
        : 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.axiosInstance.defaults.baseURL = this.config.baseURL;
  }
}