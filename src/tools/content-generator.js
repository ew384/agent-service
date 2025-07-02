// src/tools/content-generator.js - MVP版本
import fetch from 'node-fetch';
import { TOOL_CONFIGS } from '../config/workflows.js';

export class ContentGenerator {
    constructor() {
        this.config = TOOL_CONFIGS['content-generator'];
        this.lastUsed = null;
        this.apiKey = process.env.LLM_API_KEY || 'test1';
        this.provider = process.env.LLM_PROVIDER || 'claude';

        console.log('📝 文案生成器初始化完成');
    }

    // 执行文案生成任务
    async execute(params, progressCallback) {
        console.log('✍️ 开始生成文案:', params);

        const {
            topic,
            style = 'travel',
            length = 'medium',
            keywords = [],
            source_file = null,
            content_type = 'general'
        } = params;

        try {
            progressCallback({
                progress: 10,
                message: '正在构建文案生成提示词...'
            });

            // 构建提示词
            const prompt = this.buildContentPrompt(topic, style, length, keywords, source_file, content_type);

            progressCallback({
                progress: 30,
                message: '正在调用AI生成文案...'
            });

            // 调用LLM API
            const response = await this.callLLMAPI(prompt);

            progressCallback({
                progress: 70,
                message: '正在处理生成结果...'
            });

            // 解析生成结果
            const result = this.parseGeneratedContent(response.response);

            progressCallback({
                progress: 90,
                message: '正在优化文案格式...'
            });

            // 优化和验证结果
            const finalResult = this.optimizeContent(result, style);

            this.lastUsed = Date.now();

            progressCallback({
                progress: 100,
                message: '文案生成完成'
            });

            return {
                success: true,
                title: finalResult.title,
                description: finalResult.description,
                tags: finalResult.tags,
                hashtags: finalResult.hashtags,
                style: style,
                topic: topic,
                word_count: finalResult.word_count,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ 文案生成失败:', error);
            throw new Error(`文案生成失败: ${error.message}`);
        }
    }

    // 构建文案生成提示词
    buildContentPrompt(topic, style, length, keywords, sourceFile, contentType) {
        if (topic === 'video_publish_auto') {
            return `请为抖音视频生成发布标题和描述：
    
    视频类型: agent操作指导类视频
    目标平台: 抖音
    
    请生成以下内容并以JSON格式返回：
    {
      "title": "吸引人的标题（8-20字）",
      "description": "简洁描述 #相关标签1 #相关标签2 #相关标签3"
    }
    
    要求：
    1. 标题要吸引人且适合抖音用户
    2. 描述要简洁，包含2-3个热门相关标签
    3. 标签格式：#标签名称（标签间用空格分隔）
    4. 内容要适合agent/AI操作指导类视频
    5. 标题控制在8-20字之间
    
    示例格式：
    - 标题：AI智能助手操作教程
    - 描述：超实用的AI操作技巧分享 #AI教程 #智能助手 #操作指南`;
        }
        let prompt = `请为以下主题生成高质量的文案内容：

主题: ${topic}
风格: ${style}
长度: ${length}
关键词: ${keywords.length > 0 ? keywords.join(', ') : '无特定关键词'}
`;

        if (sourceFile) {
            prompt += `\n参考文件: ${sourceFile}`;
        }

        if (contentType === 'video') {
            prompt += '\n\n这是为视频内容生成的文案，需要适合视频表达。';
        } else if (contentType === 'audio_image_mix') {
            prompt += '\n\n这是为音频+图片内容生成的文案，需要适合图文展示。';
        }

        prompt += `

请生成以下内容并以JSON格式返回：
{
  "title": "吸引人的标题（8-20字）",
  "description": "详细描述内容（100-500字）",
  "tags": ["标签1", "标签2", "标签3"],
  "hashtags": ["#话题1", "#话题2", "#话题3"]
}

要求：
1. 标题要吸引人且符合${style}风格
2. 描述要生动有趣，包含具体细节
3. 标签要准确反映内容主题
4. 话题标签要流行且相关
5. 内容要原创且有价值

特别针对${topic}主题，请结合当前热门趋势和用户兴趣点。`;

        return prompt;
    }

    // 调用LLM API
    async callLLMAPI(prompt) {
        const url = `${this.config.api_endpoint}/${this.apiKey}/chat/${this.provider}`;

        console.log(`🔗 调用文案生成API: ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                newChat: true,
                stream: false
            }),
            timeout: this.config.timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'LLM API返回错误');
        }

        return data;
    }

    // 解析生成的内容
    parseGeneratedContent(llmResponse) {
        try {
            // 尝试从响应中提取JSON
            const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed;
            } else {
                // 备用解析：手动提取内容
                return this.fallbackContentParsing(llmResponse);
            }
        } catch (error) {
            console.warn('⚠️ JSON解析失败，使用备用解析:', error);
            return this.fallbackContentParsing(llmResponse);
        }
    }

    // 备用内容解析
    fallbackContentParsing(text) {
        const lines = text.split('\n').filter(line => line.trim());

        let title = '';
        let description = '';
        const tags = [];
        const hashtags = [];

        for (const line of lines) {
            const cleanLine = line.trim();

            // 提取标题
            if (!title && (cleanLine.includes('标题') || cleanLine.includes('Title'))) {
                const titleMatch = cleanLine.match(/[:：](.+)/);
                if (titleMatch) {
                    title = titleMatch[1].trim().replace(/["""]/g, '');
                }
            }

            // 提取描述
            if (cleanLine.length > 20 && !cleanLine.includes('标题') && !cleanLine.includes('#') && !description) {
                description = cleanLine;
            }

            // 提取标签
            if (cleanLine.includes('#')) {
                const hashtagMatches = cleanLine.match(/#[\u4e00-\u9fa5\w]+/g);
                if (hashtagMatches) {
                    hashtags.push(...hashtagMatches);
                }
            }
        }

        // 如果没有提取到完整内容，使用默认值
        if (!title) title = '精彩内容分享';
        if (!description) description = text.substring(0, 200) + '...';
        if (hashtags.length === 0) hashtags.push('#精彩内容', '#值得分享');

        return {
            title,
            description,
            tags: tags.length > 0 ? tags : ['精彩', '分享', '内容'],
            hashtags
        };
    }

    // 优化内容
    optimizeContent(content, style) {
        // 计算字数
        const wordCount = content.description.length;

        // 确保标题长度适中
        if (content.title.length > 20) {
            content.title = content.title.substring(0, 20) + '...';
        }

        // 确保描述不为空
        if (!content.description || content.description.length < 10) {
            content.description = this.getDefaultDescription(content.title, style);
        }

        // 确保有标签
        if (!content.tags || content.tags.length === 0) {
            content.tags = this.getDefaultTags(style);
        }

        // 确保有话题标签
        if (!content.hashtags || content.hashtags.length === 0) {
            content.hashtags = this.getDefaultHashtags(style);
        }

        return {
            ...content,
            word_count: wordCount
        };
    }

    // 获取默认描述
    getDefaultDescription(title, style) {
        const templates = {
            travel: `${title}，这是一段精彩的旅行体验，值得分享给大家。在这里可以感受到不同的文化和风景，让人流连忘返。`,
            casual: `${title}，分享一些有趣的内容给大家，希望能给你们带来快乐和启发。`,
            professional: `${title}，专业内容分享，为您带来有价值的信息和见解。`,
            creative: `${title}，创意无限，让我们一起探索更多可能性。`
        };

        return templates[style] || templates.casual;
    }

    // 获取默认标签
    getDefaultTags(style) {
        const tagMap = {
            travel: ['旅行', '风景', '体验'],
            casual: ['生活', '分享', '日常'],
            professional: ['专业', '知识', '学习'],
            creative: ['创意', '灵感', '艺术']
        };

        return tagMap[style] || tagMap.casual;
    }

    // 获取默认话题标签
    getDefaultHashtags(style) {
        const hashtagMap = {
            travel: ['#旅行日记', '#风景分享', '#旅行体验'],
            casual: ['#生活记录', '#日常分享', '#美好生活'],
            professional: ['#知识分享', '#专业内容', '#学习成长'],
            creative: ['#创意分享', '#灵感时刻', '#艺术创作']
        };

        return hashtagMap[style] || hashtagMap.casual;
    }

    // 获取工具状态
    getStatus() {
        return {
            name: this.config.name,
            available: true,
            last_used: this.lastUsed,
            api_endpoint: this.config.api_endpoint,
            timeout: this.config.timeout,
            supported_styles: this.config.supported_styles
        };
    }

    // 估算生成时间
    estimateGenerationTime(length) {
        const timeMap = {
            short: 10,
            medium: 15,
            long: 25
        };

        return timeMap[length] || 15;
    }
}