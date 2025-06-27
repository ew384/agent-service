// agent-service/index.js - MVP版本
import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { AgentController } from './src/core/agent-controller.js';

const app = express();
const HTTP_PORT = process.env.AGENT_HTTP_PORT || 3213;
const WS_PORT = process.env.AGENT_WS_PORT || 3214;

// HTTP 中间件
app.use(cors());
app.use(express.json());

// 初始化Agent控制器
const agentController = new AgentController();

// HTTP API 路由
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        service: 'Agent Service MVP',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        features: ['douyin_download', 'content_generation']
    });
});

// 获取可用工作流
app.get('/api/workflows', (req, res) => {
    res.json({
        success: true,
        workflows: agentController.getAvailableWorkflows()
    });
});

// 创建新会话
app.post('/api/sessions', (req, res) => {
    const sessionId = uuidv4();
    agentController.createSession(sessionId);

    res.json({
        success: true,
        sessionId: sessionId,
        message: '会话创建成功'
    });
});

// WebSocket 服务器
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws, req) => {
    console.log('🔗 新的WebSocket连接');

    // 为每个连接创建会话
    const sessionId = uuidv4();
    agentController.createSession(sessionId);

    // 绑定会话到WebSocket
    ws.sessionId = sessionId;
    ws.isAlive = true;

    // 发送欢迎消息
    ws.send(JSON.stringify({
        type: 'welcome',
        sessionId: sessionId,
        message: '👋 欢迎使用AI Agent服务！我可以帮您：\n1. 下载抖音内容并生成文案\n2. 更多功能开发中...\n\n请告诉我您想要做什么？',
        available_commands: [
            '下载抖音视频并生成旅行文案',
            '帮我下载 [抖音链接] 的音频',
            '生成关于非洲旅行的文案'
        ]
    }));

    // 处理消息
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`📨 收到消息:`, message);

            if (message.type === 'user_message') {
                await agentController.processUserMessage(
                    sessionId,
                    message.content,
                    (response) => {
                        if (ws.readyState === ws.OPEN) {
                            ws.send(JSON.stringify(response));
                        }
                    }
                );
            } else if (message.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (error) {
            console.error('❌ 处理WebSocket消息失败:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: '消息处理失败，请重试'
            }));
        }
    });

    // 处理连接关闭
    ws.on('close', () => {
        console.log('🔌 WebSocket连接关闭');
        agentController.deleteSession(sessionId);
    });

    // 心跳检测
    ws.on('pong', () => {
        ws.isAlive = true;
    });
});

// 心跳检测定时器
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            console.log('💔 检测到僵尸连接，终止连接');
            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

// 启动HTTP服务器
app.listen(HTTP_PORT, () => {
    console.log(`🚀 Agent HTTP服务启动: http://localhost:${HTTP_PORT}`);
    console.log(`📡 Agent WebSocket服务启动: ws://localhost:${WS_PORT}`);
    console.log(`📋 API文档:`);
    console.log(`   GET  /api/health - 健康检查`);
    console.log(`   GET  /api/workflows - 获取可用工作流`);
    console.log(`   POST /api/sessions - 创建新会话`);
    console.log(`\n💡 使用方式: 连接到WebSocket并发送JSON消息`);
    console.log(`   {"type": "user_message", "content": "下载抖音视频并生成旅行文案"}`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭服务...');
    clearInterval(heartbeatInterval);
    wss.close(() => {
        console.log('✅ WebSocket服务已关闭');
        process.exit(0);
    });
});