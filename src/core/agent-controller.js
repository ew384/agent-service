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
            // 🆕 统一LLM分析：每轮都进行完整的上下文分析
            console.log(`🧠 开始统一LLM上下文分析...`);
            console.log(`📊 当前会话状态:`, {
                hasWorkflow: !!session.currentWorkflow,
                workflowName: session.currentWorkflow?.name,
                currentStep: session.currentStep,
                workflowData: session.workflowData
            });

            const analysisResult = await this.llmClient.analyzeWithContext(message, session);
            console.log(`🧠 LLM分析结果:`, analysisResult);

            // 根据分析结果执行不同的操作
            switch (analysisResult.action) {
                case 'start_workflow':
                    return this.handleWorkflowStart(session, analysisResult, sendResponse);

                case 'continue_workflow':
                    return this.handleWorkflowContinue(session, analysisResult, sendResponse);

                case 'execute_step':
                    return this.handleStepExecution(session, analysisResult, sendResponse);

                case 'need_more_info':
                    return this.handleNeedMoreInfo(session, analysisResult, sendResponse);

                case 'chat':
                    return sendResponse({
                        type: 'chat_response',
                        message: analysisResult.response
                    });

                default:
                    return sendResponse({
                        type: 'need_clarification',
                        message: analysisResult.question || '请告诉我您想要做什么？'
                    });
            }

        } catch (error) {
            console.error('❌ 处理用户消息失败:', error);
            return sendResponse({
                type: 'error',
                message: `处理失败: ${error.message}`,
                error_code: 'PROCESSING_ERROR'
            });
        }
    }
    // 🆕 根据任务类型获取工作流
    getWorkflowByType(taskType) {
        const workflowMap = {
            'douyin_content_creation': WORKFLOWS.DOUYIN_CONTENT_CREATION,
            'video_publish': WORKFLOWS.VIDEO_PUBLISH,
            'content_generation': WORKFLOWS.DOUYIN_CONTENT_CREATION, // 复用现有工作流
            '视频发布到社交平台': WORKFLOWS.VIDEO_PUBLISH,
            '抖音内容下载和创作': WORKFLOWS.DOUYIN_CONTENT_CREATION
        };

        return workflowMap[taskType] || null;
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
    async handleWorkflowStart(session, analysisResult, sendResponse) {
        const workflow = this.getWorkflowByType(analysisResult.workflow_type);
        if (!workflow) {
            return sendResponse({
                type: 'need_clarification',
                message: '抱歉，暂不支持该类型的任务。'
            });
        }

        // 设置工作流和参数
        session.currentWorkflow = workflow;
        session.currentStep = 0;
        session.workflowData = analysisResult.all_params;

        console.log(`✅ 启动工作流: ${workflow.name}, 已提取参数:`, session.workflowData);

        return sendResponse({
            type: 'task_started',
            workflow: workflow.name,
            message: analysisResult.question,
            extracted_info: analysisResult.all_params,
            next_step: workflow.steps[0].name
        });
    }

    async handleWorkflowContinue(session, analysisResult, sendResponse) {
        // 更新参数但不执行
        session.workflowData = {
            ...session.workflowData,
            ...analysisResult.all_params
        };

        return sendResponse({
            type: 'need_more_info',
            message: analysisResult.question,
            extracted_info: analysisResult.all_params,
            missing_params: analysisResult.missing_params,
            step: session.currentWorkflow.steps[session.currentStep].name
        });
    }

    async handleStepExecution(session, analysisResult, sendResponse) {
        // 🆕 添加工作流初始化逻辑（与 handleNeedMoreInfo 保持一致）
        if (!session.currentWorkflow && analysisResult.workflow_type) {
            const workflow = this.getWorkflowByType(analysisResult.workflow_type);
            if (workflow) {
                session.currentWorkflow = workflow;
                session.currentStep = 0;
                session.workflowData = analysisResult.all_params || {};

                console.log(`✅ 设置工作流状态: ${workflow.name}`);
                console.log(`📋 保存已提取参数:`, session.workflowData);
            } else {
                return sendResponse({
                    type: 'error',
                    message: '无法识别的工作流类型'
                });
            }
        }

        console.log(`🔄 执行步骤处理 - 步骤: ${session.currentWorkflow.steps[session.currentStep].name}`);
        
        // 更新参数
        session.workflowData = {
            ...session.workflowData,
            ...analysisResult.all_params
        };
        console.log(`📋 合并后的完整参数:`, session.workflowData);

        // 复用现有的步骤执行逻辑
        return this.executeCurrentStep(session, sendResponse);
    }

    async handleNeedMoreInfo(session, analysisResult, sendResponse) {
        // 🆕 关键修复：设置工作流状态和保存参数
        if (!session.currentWorkflow && analysisResult.workflow_type) {
            const workflow = this.getWorkflowByType(analysisResult.workflow_type);
            if (workflow) {
                session.currentWorkflow = workflow;
                session.currentStep = 0;
                session.workflowData = analysisResult.all_params || {};

                console.log(`✅ 设置工作流状态: ${workflow.name}`);
                console.log(`📋 保存已提取参数:`, session.workflowData);
            }
        } else {
            // 如果已有工作流，合并参数
            session.workflowData = {
                ...session.workflowData,
                ...analysisResult.all_params
            };
            console.log(`📋 合并参数:`, session.workflowData);
        }

        return sendResponse({
            type: 'need_more_info',
            message: analysisResult.question,
            required_params: analysisResult.missing_params,
            step: session.currentWorkflow?.steps[session.currentStep]?.name || 'prepare_content',
            extracted_info: session.workflowData  // 🆕 返回已提取的信息
        });
    }

    // 🆕 提取步骤执行逻辑
    async executeCurrentStep(session, sendResponse) {
        const currentStep = session.currentWorkflow.steps[session.currentStep];
        console.log(`📋 执行步骤: ${currentStep.name}`);

        // 验证参数是否齐全
        const missingParams = currentStep.required_params.filter(
            param => !session.workflowData[param]
        );

        if (missingParams.length > 0) {
            console.log(`⚠️ 仍缺少必需参数:`, missingParams);
            return sendResponse({
                type: 'need_more_info',
                message: `还需要以下信息：${missingParams.join('、')}`,
                required_params: missingParams,
                step: currentStep.name,
                extracted_info: session.workflowData
            });
        }

        // 执行当前步骤
        sendResponse({
            type: 'step_executing',
            step: currentStep.name,
            message: `正在执行: ${currentStep.name}...`,
            progress: 0
        });

        const stepResult = await this.workflowEngine.executeStep(
            currentStep,
            session.workflowData,  // 使用合并后的参数
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

        // 保存步骤结果
        session.workflowData[currentStep.id] = stepResult.data;

        // 检查是否完成所有步骤
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

        // 继续下一步
        session.currentStep++;
        const nextStep = session.currentWorkflow.steps[session.currentStep];

        return sendResponse({
            type: 'step_completed',
            completed_step: currentStep.name,
            result: stepResult.data,
            next_step: nextStep.name,
            message: `✅ ${currentStep.name}已完成！\n\n继续执行下一步：${nextStep.name}...`
        });
    }
}
