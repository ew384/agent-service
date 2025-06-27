// src/tools/douyin-downloader.js - MVP版本
import fetch from 'node-fetch';
import { TOOL_CONFIGS } from '../config/workflows.js';

export class DouyinDownloader {
    constructor() {
        this.config = TOOL_CONFIGS['douyin-downloader'];
        this.lastUsed = null;

        console.log('📥 抖音下载器初始化完成');
    }

    // 执行下载任务
    async execute(params, progressCallback) {
        console.log('🎵 开始下载抖音内容:', params);

        const { douyin_url, output_format = 'auto' } = params;

        try {
            // 更新进度
            progressCallback({
                progress: 10,
                message: '正在解析抖音链接...'
            });

            // 调用下载API
            const response = await this.callDownloadAPI(douyin_url);

            progressCallback({
                progress: 50,
                message: '正在下载内容...'
            });

            // 处理下载结果
            const result = await this.processDownloadResult(response);

            progressCallback({
                progress: 90,
                message: '下载完成，正在处理结果...'
            });

            // 记录使用时间
            this.lastUsed = Date.now();

            progressCallback({
                progress: 100,
                message: '抖音内容下载完成'
            });

            return {
                success: true,
                type: result.type,
                fileName: result.fileName,
                filePath: result.filePath,
                fileSize: result.fileSize,
                duration: result.duration,
                resolution: result.resolution,
                downloadedAt: new Date().toISOString(),
                originalUrl: douyin_url
            };

        } catch (error) {
            console.error('❌ 抖音下载失败:', error);
            throw new Error(`抖音下载失败: ${error.message}`);
        }
    }

    // 调用下载API
    async callDownloadAPI(url) {
        console.log(`🔗 调用下载API: ${this.config.api_endpoint}`);

        const response = await fetch(this.config.api_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url
            }),
            timeout: this.config.timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '下载API返回失败');
        }

        return data;
    }

    // 处理下载结果
    async processDownloadResult(apiResponse) {
        const { type, result } = apiResponse;

        if (type === 'video') {
            // 视频下载结果
            return {
                type: 'video',
                fileName: result.fileName,
                filePath: result.filePath,
                fileSize: result.fileSize,
                duration: result.duration,
                resolution: result.resolution
            };
        } else if (type === 'audio_image_mix') {
            // 音频+图片下载结果
            return {
                type: 'audio_image_mix',
                folderName: result.folderName,
                folderPath: result.folderPath,
                totalFiles: result.totalFiles,
                totalSize: result.totalSize,
                audioInfo: result.audio,
                imageCount: result.imageCount,
                images: result.images
            };
        } else {
            throw new Error(`不支持的内容类型: ${type}`);
        }
    }

    // 验证抖音URL
    validateUrl(url) {
        const patterns = [
            /^https?:\/\/www\.douyin\.com\/video\/\d+/,
            /^https?:\/\/v\.douyin\.com\/[A-Za-z0-9]+/
        ];

        return patterns.some(pattern => pattern.test(url));
    }

    // 获取支持的格式
    getSupportedFormats() {
        return this.config.supported_formats;
    }

    // 获取工具状态
    getStatus() {
        return {
            name: this.config.name,
            available: true,
            last_used: this.lastUsed,
            api_endpoint: this.config.api_endpoint,
            timeout: this.config.timeout,
            supported_formats: this.config.supported_formats
        };
    }

    // 估算下载时间
    estimateDownloadTime(url) {
        // 简单估算：大部分抖音视频在30秒内下载完成
        return 30;
    }
}