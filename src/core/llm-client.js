// src/core/llm-client.js - MVP版本
import fetch from 'node-fetch';

export class LLMClient {
    constructor() {
        this.apiUrl = process.env.LLM_API_URL || 'http://localhost:3212/api/llm';
        this.apiKey = process.env.LLM_API_KEY || 'test1';
        this.provider = process.env.LLM_PROVIDER || 'claude';

        console.log(`🧠 LLM客户端初始化: ${this.apiUrl}/${this.apiKey}/chat/${this.provider}`);
    }
    // 🆕 统一的上下文感知分析
    async analyzeWithContext(userInput, session) {
        console.log(`🔍 统一上下文分析 - 输入: ${userInput}`);

        const prompt = this.buildContextAnalysisPrompt(userInput, session);

        try {
            const response = await this.callLLM(prompt, 3); // 重试3次
            const parsed = this.parseContextResponse(response.response);
            console.log(`✅ 统一分析结果:`, parsed);
            return parsed;
        } catch (error) {
            console.error('❌ 统一分析失败:', error);
            return {
                action: 'need_clarification',
                question: '请告诉我您想要做什么？我可以帮您下载抖音内容、生成文案或发布视频。'
            };
        }
    }

    buildContextAnalysisPrompt(userInput, session) {
        const hasWorkflow = !!session.currentWorkflow;
        const workflowData = session.workflowData || {};

        let prompt = `请帮我分析这个用户请求，并提供结构化的分析结果。
    
    用户说: "${userInput}"`;

        if (hasWorkflow) {
            prompt += `
    
    当前对话背景:
    - 正在处理: ${session.currentWorkflow.name}
    - 进行到步骤: ${session.currentStep + 1}/${session.currentWorkflow.steps.length}
    - 当前步骤: ${session.currentWorkflow.steps[session.currentStep].name}
    - 需要的参数: ${session.currentWorkflow.steps[session.currentStep].required_params.join(', ')}
    
    已经收集到的信息:
    ${JSON.stringify(workflowData, null, 2)}`;
        } else {
            prompt += `
    
    当前对话背景: 这是新的对话开始`;
        }

        prompt += `
    
    请分析用户的需求类型:
    - 抖音内容下载和创作
    - 视频发布到社交平台  
    - 纯文案生成
    - 日常对话
    
    请提取用户提到的所有相关信息(账号、平台、文件路径、标题、描述等)，并判断下一步应该:
    - 开始新任务
    - 继续当前任务
    - 执行操作(信息已齐全)
    - 询问更多信息
    - 普通对话回复
    
    请用这样的格式来组织你的分析:
    
    {
      "需求类型": "具体的任务类型",
      "下一步操作": "建议的行动",
      "提取的信息": {
        "账号": "用户的账号",
        "平台": "目标平台",
        "文件": "文件路径",
        "标题": "内容标题", 
        "描述": "内容描述"
      },
      "还需要的信息": ["缺少的信息列表"],
      "回复用户": "给用户的回复内容",
      "分析说明": "你的分析思路"
    }
    
    请确保保留所有之前已经收集到的信息，并与新信息合并。`;

        return prompt;
    }
    // 🆕 解析上下文响应
    parseContextResponse(llmResponse) {
        try {
            const responseStr = typeof llmResponse === 'string' ? llmResponse : JSON.stringify(llmResponse);

            // 更灵活的JSON提取
            const jsonMatch = responseStr.match(/\{[\s\S]*?\}(?=\s*$|$)/);
            if (!jsonMatch) {
                console.warn('⚠️ 未找到JSON，使用文本解析');
                return this.parseTextResponse(responseStr);
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // 映射到标准格式
            return {
                action: this.mapToAction(parsed),
                workflow_type: this.mapToWorkflowType(parsed),
                all_params: this.extractParams(parsed),
                missing_params: this.extractMissingParams(parsed),
                question: parsed["回复用户"] || parsed.question || '请告诉我您需要什么帮助？',
                reasoning: parsed["分析说明"] || parsed.reasoning || ''
            };

        } catch (error) {
            console.error('❌ JSON解析失败:', error);
            return this.parseTextResponse(llmResponse);
        }
    }

    // 新增辅助方法
    mapToAction(parsed) {
        const operation = parsed["下一步操作"] || '';

        if (operation.includes('开始') || operation.includes('新任务')) {
            return 'start_workflow';
        } else if (operation.includes('继续')) {
            return 'continue_workflow';
        } else if (operation.includes('执行') || operation.includes('齐全')) {
            return 'execute_step';
        } else if (operation.includes('询问') || operation.includes('更多')) {
            return 'need_more_info';
        } else if (operation.includes('对话') || operation.includes('聊天')) {
            return 'chat';
        }

        return 'need_more_info';
    }

    mapToWorkflowType(parsed) {
        const taskType = parsed["需求类型"] || '';

        if (taskType.includes('发布') || taskType.includes('视频')) {
            return 'video_publish';
        } else if (taskType.includes('抖音') || taskType.includes('下载')) {
            return 'douyin_content_creation';
        } else if (taskType.includes('文案')) {
            return 'content_generation';
        }

        return 'video_publish';
    }

    extractParams(parsed) {
        const info = parsed["提取的信息"] || {};

        return {
            account: info["账号"] || info.account || null,
            platform: info["平台"] || info.platform || null,
            video_file: info["文件"] || info.video_file || null,
            title: info["标题"] || info.title || null,
            description: info["描述"] || info.description || null
        };
    }

    extractMissingParams(parsed) {
        const missing = parsed["还需要的信息"] || parsed.missing_params || [];
        return Array.isArray(missing) ? missing : [];
    }

    // 纯文本解析备用方案
    parseTextResponse(text) {
        console.log('🔄 使用文本解析模式');

        // 基于关键词的简单解析
        const lowerText = text.toLowerCase();

        if (lowerText.includes('发布') && lowerText.includes('视频')) {
            return {
                action: 'start_workflow',
                workflow_type: 'video_publish',
                all_params: this.extractParamsFromText(text),
                missing_params: ['video_file', 'title', 'description'],
                question: '请提供视频文件路径、标题和描述信息。'
            };
        }

        return {
            action: 'need_clarification',
            question: '请告诉我您想要做什么？'
        };
    }
    fallbackContextParsing(response, session = null) {
        const responseStr = String(response || '');
        const lowerResponse = responseStr.toLowerCase();

        // 🆕 获取历史参数
        const historicalParams = session?.workflowData || {};
        console.log(`🔄 兜底解析，历史参数:`, historicalParams);

        // 基本的意图识别
        if (lowerResponse.includes('你好') || lowerResponse.includes('能做什么')) {
            return {
                action: 'chat',
                response: '你好！我可以帮您下载抖音内容、生成文案或发布视频。请告诉我您想要做什么？'
            };
        }

        // 🆕 智能合并参数
        const all_params = { ...historicalParams }; // 先复制历史参数

        // 从当前输入提取新参数
        if (lowerResponse.includes('视频文件') || lowerResponse.includes('路径')) {
            const pathMatch = responseStr.match(/[./][\w/.-]+\.mp4/);
            if (pathMatch) {
                all_params.video_file = pathMatch[0];
            }
        }

        if (lowerResponse.includes('标题')) {
            const titleMatch = responseStr.match(/标题[是：]*([^，。]+)/);
            if (titleMatch) {
                all_params.title = titleMatch[1].trim();
            }
        }

        if (lowerResponse.includes('描述') || lowerResponse.includes('#')) {
            const descMatch = responseStr.match(/描述[是：]*(.+)/);
            if (descMatch) {
                all_params.description = descMatch[1].trim();
            }
        }

        // 判断是否有足够参数执行
        const requiredParams = ['account', 'platform', 'video_file', 'title', 'description'];
        const missingParams = requiredParams.filter(param => !all_params[param]);

        console.log(`📋 兜底分析结果:`, { all_params, missingParams });

        if (missingParams.length === 0) {
            return {
                action: 'execute_step',
                workflow_type: 'video_publish',
                all_params: all_params,
                missing_params: [],
                question: '开始执行视频发布...'
            };
        } else {
            return {
                action: 'need_more_info',
                workflow_type: 'video_publish',
                all_params: all_params,
                missing_params: missingParams,
                question: `请提供：${missingParams.join('、')}`
            };
        }
    }
    async callLLM(prompt) {
        const url = `${this.apiUrl}/${this.apiKey}/chat/${this.provider}`;
        console.log(`🔗 调用LLM: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            // 🆕 处理对话历史，提取最后一条assistant消息
            let actualResponse = data.response;

            if (typeof data.response === 'object' && data.response.messages) {
                // 找到最后一条assistant消息
                const messages = data.response.messages;
                const lastAssistantMessage = messages.slice().reverse().find(msg => msg.role === 'assistant');

                if (lastAssistantMessage && lastAssistantMessage.content) {
                    actualResponse = lastAssistantMessage.content;
                    console.log('🎯 提取最后一条assistant消息:', actualResponse);
                } else {
                    console.warn('⚠️ 未找到assistant消息，使用原始响应');
                    actualResponse = JSON.stringify(data.response);
                }
            }

            return {
                success: true,
                response: actualResponse,
                conversationId: data.conversationId || data.response?.id
            };

        } catch (error) {
            console.error('❌ LLM API调用失败:', error);
            throw error;
        }
    }
}