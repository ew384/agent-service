// src/config/workflows.js - MVP工作流配置
export const WORKFLOWS = {
    // MVP版本：抖音下载 + 文案生成
    DOUYIN_CONTENT_CREATION: {
        id: 'douyin-content-creation',
        name: '抖音内容下载与文案生成',
        description: '下载抖音视频/音频内容，并生成相关文案',
        category: 'content',
        estimated_time: 45, // 预估时间（秒）

        steps: [
            {
                id: 'download_content',
                name: '下载抖音内容',
                description: '从抖音链接下载视频或音频内容',
                tool: 'douyin-downloader',
                required_params: ['douyin_url'],
                optional_params: ['output_format'],
                validation: {
                    douyin_url: {
                        type: 'url',
                        pattern: /(douyin\.com|v\.douyin\.com)/,
                        message: '请提供有效的抖音链接'
                    }
                }
            },
            {
                id: 'generate_content',
                name: '生成文案',
                description: '基于下载的内容生成相关文案',
                tool: 'content-generator',
                required_params: ['topic'],
                optional_params: ['style', 'length', 'keywords'],
                validation: {
                    topic: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 50,
                        message: '请提供2-50字符的主题'
                    }
                }
            }
        ],

        // 数据流定义（步骤间的数据传递）
        data_flow: {
            'download_content.fileName': 'generate_content.source_file',
            'download_content.type': 'generate_content.content_type'
        },

        // 成功条件
        success_criteria: {
            'download_content': ['fileName', 'filePath'],
            'generate_content': ['title', 'description']
        }
    },

    // 未来扩展的工作流（占位）
    FULL_CONTENT_PIPELINE: {
        id: 'full-content-pipeline',
        name: '完整内容创作流水线',
        description: '抖音下载 → 文案生成 → TTS → 视频合成 → 多平台发布',
        category: 'content',
        estimated_time: 300,
        status: 'planned', // 计划中

        steps: [
            {
                id: 'download_content',
                name: '下载抖音内容',
                tool: 'douyin-downloader',
                required_params: ['douyin_url']
            },
            {
                id: 'generate_content',
                name: '生成文案',
                tool: 'content-generator',
                required_params: ['topic']
            },
            {
                id: 'generate_audio',
                name: '生成语音',
                tool: 'tts-generator',
                required_params: ['text', 'voice_character']
            },
            {
                id: 'compose_video',
                name: '合成视频',
                tool: 'video-composer',
                required_params: ['images', 'audio_files']
            },
            {
                id: 'publish_content',
                name: '发布内容',
                tool: 'platform-publisher',
                required_params: ['video_file', 'platforms']
            }
        ]
    },

    SIMPLE_PUBLISH: {
        id: 'simple-publish',
        name: '简单发布',
        description: '直接发布已有内容到多个平台',
        category: 'publish',
        estimated_time: 60,
        status: 'planned',

        steps: [
            {
                id: 'select_content',
                name: '选择内容',
                tool: 'content-selector',
                required_params: ['content_file']
            },
            {
                id: 'generate_metadata',
                name: '生成元数据',
                tool: 'content-generator',
                required_params: ['title', 'description']
            },
            {
                id: 'publish_content',
                name: '发布内容',
                tool: 'platform-publisher',
                required_params: ['platforms']
            }
        ]
    }
};

// 工具配置
export const TOOL_CONFIGS = {
    'douyin-downloader': {
        name: '抖音下载器',
        api_endpoint: 'http://localhost:3211/api/download/douyin',
        timeout: 30000,
        retry_count: 2,
        supported_formats: ['video', 'audio'],
        max_file_size: '500MB'
    },

    'content-generator': {
        name: '文案生成器',
        api_endpoint: 'http://localhost:3212/api/llm',
        timeout: 20000,
        retry_count: 2,
        supported_styles: ['professional', 'casual', 'creative', 'travel'],
        max_length: 2000
    },

    'tts-generator': {
        name: 'TTS语音生成器',
        api_endpoint: 'http://localhost:8000/tts_with_character',
        timeout: 30000,
        retry_count: 1,
        supported_voices: ['JackMa', 'default'],
        supported_formats: ['wav', 'mp3']
    },

    'video-composer': {
        name: '视频合成器',
        api_endpoint: 'http://localhost:8001/api/v1/video/create',
        timeout: 120000,
        retry_count: 1,
        supported_formats: ['mp4'],
        max_images: 50,
        max_duration: 300
    },

    'platform-publisher': {
        name: '多平台发布器',
        api_endpoint: 'http://localhost:3211/api/workflow/multi-execute-concurrent',
        timeout: 180000,
        retry_count: 1,
        supported_platforms: ['douyin', 'xiaohongshu', 'wechat'],
        max_platforms: 5
    }
};

// 工作流状态
export const WORKFLOW_STATUS = {
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

// 步骤状态
export const STEP_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    SKIPPED: 'skipped'
};