// src/core/agent-controller.js - MVP版本
import { LLMClient } from './llm-client.js';
import { WorkflowEngine } from './workflow-engine.js';
import { SessionManager } from './session-manager.js';
import { WORKFLOWS } from '../config/workflows.js';

export class AgentController {
    constructor() {
        this.llmClient = new LLMClient();
        this.workflowEngine = new WorkflowEngine();
        this.sessionManager = new SessionManager();

        console.log('🤖 Agent控制器初始化完成');
    }

    // 创建新会话
    createSession(sessionId) {
        return this.sessionManager.createSession(sessionId);
    }

    // 删除会话
    deleteSession(sessionId) {
        return this.sessionManager.deleteSession(sessionId);
    }

    // 获取可用工作流
    getAvailableWorkflows() {
        return Object.values(WORKFLOWS).map(workflow => ({
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            steps: workflow.steps.length
        }));
    }

    // 处理用户消息 - 核心逻辑
    async processUserMessage(sessionId, message, sendResponse) {
        console.log(`🎯 处理用户消息 [${sessionId}]: ${message}`);

        const session = this.sessionManager.getSession(sessionId);
        if (!session) {
            return sendResponse({
                type: 'error',
                message: '会话不存在，请刷新页面重试'
            });
        }

        try {
            // 1. 如果是新对话，识别工作流
            if (!session.currentWorkflow) {
                const workflowResult = await this.identifyWorkflow(message);

                if (!workflowResult.success) {
                    return sendResponse({
                        type: 'need_clarification',
                        message: '抱歉，我没有理解您的需求。我目前可以帮您：\n1. 下载抖音内容并生成文案\n\n请告诉我具体想要做什么？'
                    });
                }

                session.currentWorkflow = workflowResult.workflow;
                session.currentStep = 0;
                session.workflowData = {};

                return sendResponse({
                    type: 'workflow_started',
                    workflow: workflowResult.workflow.name,
                    message: `好的！我将帮您${workflowResult.workflow.name}。\n\n第一步：${workflowResult.workflow.steps[0].name}`,
                    next_step: workflowResult.workflow.steps[0]
                });
            }

            // 2. 处理当前步骤
            const currentStep = session.currentWorkflow.steps[session.currentStep];
            console.log(`📋 执行步骤: ${currentStep.name}`);

            // 3. 提取参数
            const paramResult = await this.llmClient.extractParameters(message, currentStep);

            if (!paramResult.success) {
                return sendResponse({
                    type: 'need_more_info',
                    message: paramResult.question || `请提供${currentStep.name}所需的信息`,
                    required_params: currentStep.required_params,
                    step: currentStep.name
                });
            }

            // 4. 执行当前步骤
            sendResponse({
                type: 'step_executing',
                step: currentStep.name,
                message: `正在执行: ${currentStep.name}...`,
                progress: 0
            });

            const stepResult = await this.workflowEngine.executeStep(
                currentStep,
                paramResult.params,
                (progress) => {
                    sendResponse({
                        type: 'step_progress',
                        step: currentStep.name,
                        progress: progress.progress,
                        message: progress.message
                    });
                }
            );

            if (!stepResult.success) {
                return sendResponse({
                    type: 'step_failed',
                    step: currentStep.name,
                    error: stepResult.error,
                    message: `${currentStep.name}执行失败: ${stepResult.error}`,
                    retry_available: true
                });
            }

            // 5. 保存步骤结果
            session.workflowData[currentStep.id] = stepResult.data;

            // 6. 检查是否完成所有步骤
            if (session.currentStep >= session.currentWorkflow.steps.length - 1) {
                // 工作流完成
                const finalResult = this.generateFinalResult(session);

                // 重置会话状态
                session.currentWorkflow = null;
                session.currentStep = 0;
                session.workflowData = {};

                return sendResponse({
                    type: 'workflow_completed',
                    message: '🎉 任务完成！',
                    result: finalResult,
                    summary: this.generateSummary(finalResult)
                });
            }

            // 7. 询问是否继续下一步
            session.currentStep++;
            const nextStep = session.currentWorkflow.steps[session.currentStep];

            return sendResponse({
                type: 'step_completed',
                completed_step: currentStep.name,
                result: stepResult.data,
                next_step: nextStep.name,
                message: `✅ ${currentStep.name}已完成！\n\n是否继续执行下一步：${nextStep.name}？\n\n请回复"继续"或告诉我${nextStep.description}`
            });

        } catch (error) {
            console.error('❌ 处理用户消息失败:', error);
            return sendResponse({
                type: 'error',
                message: `处理失败: ${error.message}`,
                error_code: 'PROCESSING_ERROR'
            });
        }
    }

    // 识别工作流（简化版本 - 关键词匹配）
    async identifyWorkflow(message) {
        const lowerMessage = message.toLowerCase();
        if ((lowerMessage.includes('发布') || lowerMessage.includes('上传')) &&
            (lowerMessage.includes('视频') || lowerMessage.includes('抖音'))) {
            return {
                success: true,
                workflow: WORKFLOWS.VIDEO_PUBLISH,
                confidence: 0.9
            };
        }
        // 简单关键词匹配
        if ((lowerMessage.includes('抖音') || lowerMessage.includes('douyin')) &&
            (lowerMessage.includes('文案') || lowerMessage.includes('内容'))) {
            return {
                success: true,
                workflow: WORKFLOWS.DOUYIN_CONTENT_CREATION,
                confidence: 0.9
            };
        }

        if (lowerMessage.includes('下载') && lowerMessage.includes('抖音')) {
            return {
                success: true,
                workflow: WORKFLOWS.DOUYIN_CONTENT_CREATION,
                confidence: 0.8
            };
        }

        return {
            success: false,
            message: '无法识别工作流'
        };
    }

    // 生成最终结果
    generateFinalResult(session) {
        const { workflowData } = session;

        return {
            workflow: session.currentWorkflow.name,
            steps_completed: session.currentWorkflow.steps.length,
            results: workflowData,
            completed_at: new Date().toISOString()
        };
    }

    // 生成结果摘要
    generateSummary(result) {
        let summary = `已完成${result.workflow}，包含${result.steps_completed}个步骤：\n\n`;

        if (result.results.download_content) {
            const download = result.results.download_content;
            summary += `📥 下载完成: ${download.fileName || '内容文件'}\n`;
        }

        if (result.results.generate_content) {
            const content = result.results.generate_content;
            summary += `📝 生成文案: ${content.title || '已生成标题和内容'}\n`;
        }

        summary += `\n⏰ 完成时间: ${new Date(result.completed_at).toLocaleString()}`;

        return summary;
    }
}