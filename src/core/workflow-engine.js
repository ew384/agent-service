// src/core/workflow-engine.js - MVP版本
import { DouyinDownloader } from '../tools/douyin-downloader.js';
import { ContentGenerator } from '../tools/content-generator.js';

export class WorkflowEngine {
    constructor() {
        // 初始化工具实例
        this.tools = {
            'douyin-downloader': new DouyinDownloader(),
            'content-generator': new ContentGenerator()
        };

        console.log('⚙️ 工作流引擎初始化完成');
    }

    // 执行单个步骤
    async executeStep(stepConfig, params, progressCallback) {
        console.log(`🔄 执行步骤: ${stepConfig.name}`);
        console.log(`📋 步骤参数:`, params);

        try {
            // 验证参数
            const validation = this.validateStepParams(stepConfig, params);
            if (!validation.valid) {
                return {
                    success: false,
                    error: `参数验证失败: ${validation.errors.join(', ')}`
                };
            }

            // 获取对应的工具
            const tool = this.tools[stepConfig.tool];
            if (!tool) {
                return {
                    success: false,
                    error: `未找到工具: ${stepConfig.tool}`
                };
            }

            // 执行工具
            progressCallback({
                progress: 10,
                message: `开始执行${stepConfig.name}...`
            });

            const result = await tool.execute(params, progressCallback);

            progressCallback({
                progress: 100,
                message: `${stepConfig.name}执行完成`
            });

            return {
                success: true,
                data: result,
                step_id: stepConfig.id,
                step_name: stepConfig.name
            };

        } catch (error) {
            console.error(`❌ 步骤执行失败 [${stepConfig.name}]:`, error);
            return {
                success: false,
                error: error.message,
                step_id: stepConfig.id,
                step_name: stepConfig.name
            };
        }
    }

    // 验证步骤参数
    validateStepParams(stepConfig, params) {
        const errors = [];

        // 检查必需参数
        for (const requiredParam of stepConfig.required_params) {
            if (!params[requiredParam]) {
                errors.push(`缺少必需参数: ${requiredParam}`);
            }
        }

        // 特定参数验证
        if (params.douyin_url && !this.isValidDouyinUrl(params.douyin_url)) {
            errors.push('抖音链接格式不正确');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    // 验证抖音URL格式
    isValidDouyinUrl(url) {
        const douyinPatterns = [
            /^https?:\/\/www\.douyin\.com\/video\/\d+/,
            /^https?:\/\/v\.douyin\.com\/[A-Za-z0-9]+/,
            /^https?:\/\/[^\/]*douyin[^\/]*\/[^\/]+/
        ];

        return douyinPatterns.some(pattern => pattern.test(url));
    }

    // 获取工具状态
    getToolsStatus() {
        const status = {};

        for (const [toolName, tool] of Object.entries(this.tools)) {
            status[toolName] = {
                available: !!tool,
                initialized: true,
                last_used: tool.lastUsed || null
            };
        }

        return status;
    }

    // 估算执行时间
    estimateExecutionTime(stepConfig) {
        const timeEstimates = {
            'douyin-downloader': 30, // 30秒
            'content-generator': 15,  // 15秒
            'tts-generator': 20,      // 20秒（未来实现）
            'video-composer': 60      // 60秒（未来实现）
        };

        return timeEstimates[stepConfig.tool] || 30;
    }
}