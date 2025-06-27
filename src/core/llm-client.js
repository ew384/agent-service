// src/core/llm-client.js - MVP版本
import fetch from 'node-fetch';

export class LLMClient {
    constructor() {
        this.apiUrl = process.env.LLM_API_URL || 'http://localhost:3212/api/llm';
        this.apiKey = process.env.LLM_API_KEY || 'test1';
        this.provider = process.env.LLM_PROVIDER || 'claude';

        console.log(`🧠 LLM客户端初始化: ${this.apiUrl}/${this.apiKey}/chat/${this.provider}`);
    }

    // 提取参数 - 核心功能
    async extractParameters(userInput, stepConfig) {
        console.log(`🔍 提取参数 - 步骤: ${stepConfig.name}`);
        console.log(`📥 用户输入: ${userInput}`);

        // 构建提示词
        const prompt = this.buildParameterExtractionPrompt(userInput, stepConfig);

        try {
            const response = await this.callLLM(prompt);

            if (!response.success) {
                throw new Error(response.error || 'LLM调用失败');
            }

            // 解析LLM响应
            const parsed = this.parseParameterResponse(response.response, stepConfig);
            console.log(`✅ 参数提取结果:`, parsed);

            return parsed;

        } catch (error) {
            console.error('❌ 参数提取失败:', error);
            return {
                success: false,
                error: error.message,
                question: `请提供${stepConfig.name}所需的信息`
            };
        }
    }

    // 构建参数提取提示词
    buildParameterExtractionPrompt(userInput, stepConfig) {
        return `请从用户输入中提取以下参数：

步骤名称: ${stepConfig.name}
步骤描述: ${stepConfig.description}

必需参数: ${stepConfig.required_params.join(', ')}
可选参数: ${stepConfig.optional_params ? stepConfig.optional_params.join(', ') : '无'}

用户输入: "${userInput}"

请分析用户输入，提取相关参数。如果缺少必需参数，请生成问题询问用户。

返回JSON格式：
{
  "has_all_required": true/false,
  "extracted_params": {
    "param_name": "param_value"
  },
  "missing_params": ["missing_param1"],
  "question": "如果缺少参数，询问用户的问题"
}

特别注意：
- 抖音链接格式：https://www.douyin.com/video/xxx 或 https://v.douyin.com/xxx
- 如果用户提到"继续"，设置continue为true
- 文案主题和风格需要明确`;
    }

    // 解析LLM的参数提取响应
    parseParameterResponse(llmResponse, stepConfig) {
        try {
            // 尝试从响应中提取JSON
            const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                // 如果没有JSON，进行简单的关键词匹配
                return this.fallbackParameterExtraction(llmResponse, stepConfig);
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // 验证必需参数
            const missingRequired = stepConfig.required_params.filter(
                param => !parsed.extracted_params || !parsed.extracted_params[param]
            );

            return {
                success: missingRequired.length === 0,
                params: parsed.extracted_params || {},
                missing_params: missingRequired,
                question: parsed.question || null
            };

        } catch (error) {
            console.error('❌ 解析LLM响应失败:', error);
            return this.fallbackParameterExtraction(llmResponse, stepConfig);
        }
    }

    // 备用参数提取（关键词匹配）
    fallbackParameterExtraction(response, stepConfig) {
        const params = {};
        const lowerResponse = response.toLowerCase();

        // 检查是否是继续指令
        if (lowerResponse.includes('继续') || lowerResponse.includes('continue') || lowerResponse.includes('下一步')) {
            params.continue = true;
        }

        // 提取抖音链接
        if (stepConfig.required_params.includes('douyin_url')) {
            const urlMatch = response.match(/(https?:\/\/[^\s]+douyin[^\s]*)/i);
            if (urlMatch) {
                params.douyin_url = urlMatch[1];
            }
        }

        // 提取主题
        if (stepConfig.required_params.includes('topic')) {
            // 寻找主题相关的关键词
            const topicKeywords = ['主题', '关于', '话题', '内容'];
            for (const keyword of topicKeywords) {
                if (lowerResponse.includes(keyword)) {
                    // 简单提取：取关键词后的内容
                    const index = lowerResponse.indexOf(keyword);
                    const afterKeyword = response.substring(index + keyword.length).trim();
                    const topicMatch = afterKeyword.match(/[^\s，。！？]{2,20}/);
                    if (topicMatch) {
                        params.topic = topicMatch[0];
                        break;
                    }
                }
            }

            // 如果没找到明确主题，使用默认值
            if (!params.topic && lowerResponse.includes('旅行')) {
                params.topic = '旅行';
            }
        }

        const missingRequired = stepConfig.required_params.filter(param => !params[param]);

        return {
            success: missingRequired.length === 0,
            params: params,
            missing_params: missingRequired,
            question: missingRequired.length > 0 ? `请提供：${missingRequired.join('、')}` : null
        };
    }

    // 调用LLM API
    async callLLM(prompt) {
        const url = `${this.apiUrl}/${this.apiKey}/chat/${this.provider}`;

        console.log(`🔗 调用LLM: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    newChat: false,
                    stream: false
                }),
                timeout: 30000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'LLM API返回错误');
            }

            return {
                success: true,
                response: data.response,
                conversationId: data.conversationId
            };

        } catch (error) {
            console.error('❌ LLM API调用失败:', error);
            throw error;
        }
    }
}