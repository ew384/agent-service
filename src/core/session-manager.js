// src/core/session-manager.js - MVP版本
export class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.maxSessions = 100; // 最大会话数
        this.sessionTimeout = 30 * 60 * 1000; // 30分钟超时

        // 定期清理过期会话
        this.startCleanupTimer();

        console.log('📱 会话管理器初始化完成');
    }

    // 创建新会话
    createSession(sessionId) {
        // 检查会话数量限制
        if (this.sessions.size >= this.maxSessions) {
            this.cleanupOldestSessions(10); // 清理最老的10个会话
        }

        const session = {
            id: sessionId,
            createdAt: Date.now(),
            lastActivity: Date.now(),

            // 工作流状态
            currentWorkflow: null,
            currentStep: 0,
            workflowData: {},

            // 对话历史
            messageHistory: [],

            // 用户偏好
            preferences: {},

            // 会话状态
            status: 'active'
        };

        this.sessions.set(sessionId, session);
        console.log(`✅ 创建会话: ${sessionId}`);

        return session;
    }

    // 获取会话
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);

        if (session) {
            // 更新最后活动时间
            session.lastActivity = Date.now();
            return session;
        }

        return null;
    }

    // 更新会话
    updateSession(sessionId, updates) {
        const session = this.sessions.get(sessionId);

        if (session) {
            Object.assign(session, updates);
            session.lastActivity = Date.now();
            return session;
        }

        return null;
    }

    // 删除会话
    deleteSession(sessionId) {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            console.log(`🗑️ 删除会话: ${sessionId}`);
        }
        return deleted;
    }

    // 添加消息到历史
    addMessage(sessionId, message) {
        const session = this.sessions.get(sessionId);

        if (session) {
            session.messageHistory.push({
                ...message,
                timestamp: Date.now()
            });

            // 限制历史消息数量
            if (session.messageHistory.length > 50) {
                session.messageHistory = session.messageHistory.slice(-40);
            }

            session.lastActivity = Date.now();
        }
    }

    // 获取会话统计
    getSessionStats() {
        const now = Date.now();
        let activeCount = 0;
        let totalMessages = 0;
        let oldestSession = now;
        let newestSession = 0;

        for (const session of this.sessions.values()) {
            // 活跃会话（最近5分钟有活动）
            if (now - session.lastActivity < 5 * 60 * 1000) {
                activeCount++;
            }

            totalMessages += session.messageHistory.length;

            if (session.createdAt < oldestSession) {
                oldestSession = session.createdAt;
            }

            if (session.createdAt > newestSession) {
                newestSession = session.createdAt;
            }
        }

        return {
            totalSessions: this.sessions.size,
            activeSessions: activeCount,
            totalMessages: totalMessages,
            averageMessages: this.sessions.size > 0 ? totalMessages / this.sessions.size : 0,
            oldestSessionAge: this.sessions.size > 0 ? now - oldestSession : 0,
            newestSessionAge: this.sessions.size > 0 ? now - newestSession : 0
        };
    }

    // 清理过期会话
    cleanupExpiredSessions() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActivity > this.sessionTimeout) {
                this.sessions.delete(sessionId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`🧹 清理了 ${cleanedCount} 个过期会话`);
        }

        return cleanedCount;
    }

    // 清理最老的会话
    cleanupOldestSessions(count) {
        const sessions = Array.from(this.sessions.entries())
            .sort(([, a], [, b]) => a.lastActivity - b.lastActivity)
            .slice(0, count);

        for (const [sessionId] of sessions) {
            this.sessions.delete(sessionId);
        }

        console.log(`🧹 清理了 ${sessions.length} 个最老的会话`);
        return sessions.length;
    }

    // 启动清理定时器
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // 每5分钟清理一次

        console.log('⏰ 会话清理定时器已启动');
    }

    // 获取所有会话ID
    getAllSessionIds() {
        return Array.from(this.sessions.keys());
    }

    // 重置会话的工作流状态
    resetWorkflowState(sessionId) {
        const session = this.sessions.get(sessionId);

        if (session) {
            session.currentWorkflow = null;
            session.currentStep = 0;
            session.workflowData = {};
            session.lastActivity = Date.now();

            console.log(`🔄 重置会话工作流状态: ${sessionId}`);
            return true;
        }

        return false;
    }
}