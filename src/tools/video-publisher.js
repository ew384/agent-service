// src/tools/video-publisher.js
import fetch from 'node-fetch';
import { TOOL_CONFIGS } from '../config/workflows.js';
import { ContentGenerator } from './content-generator.js'
export class VideoPublisher {
    constructor() {
        this.config = TOOL_CONFIGS['video-publisher'];
        this.lastUsed = null;
        this.contentGenerator = new ContentGenerator();
    }

    async execute(params, progressCallback) {
        const { platform, account, video_file, title, description, auto_generate } = params;

        let finalTitle = title;
        let finalDescription = description;

        // 如果需要自动生成标题和描述
        if (auto_generate && (!title || !description)) {
            progressCallback({
                progress: 20,
                message: '正在生成标题和描述...'
            });

            // 使用已初始化的实例
            const contentResult = await this.contentGenerator.execute({
                topic: 'video_publish_auto',
                style: 'casual',
                length: 'short'
            }, () => { });

            finalTitle = contentResult.title;
            finalDescription = contentResult.description;

            progressCallback({
                progress: 50,
                message: `生成完成 - 标题: ${finalTitle}`
            });
        }

        // 调用发布API
        progressCallback({
            progress: 70,
            message: '正在发布视频...'
        });

        const response = await fetch('http://127.0.0.1:5001/api/upload/simple', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platform,
                account,
                video_file,
                title: finalTitle,
                description: finalDescription
            })
        });

        return {
            success: true,
            title: finalTitle,
            description: finalDescription,
            publish_result: await response.json()
        };
    }
}