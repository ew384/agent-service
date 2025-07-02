// quick-test.js - 最简单的Agent服务测试脚本
import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3214';

console.log('🚀 开始测试Agent服务...');

// 测试消息列表
const testMessages = [
    '你好',
    '下载抖音视频并生成旅行文案',
    'https://v.douyin.com/ieFfbDsj/',
    '非洲旅行',
    '继续'
];

let messageIndex = 0;
let ws = null;

function connectAndTest() {
    console.log(`🔗 连接到: ${WS_URL}`);

    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log('✅ WebSocket连接成功');

        // 开始发送测试消息
        sendNextMessage();
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('📨 收到消息:', message.type);
            console.log('   内容:', message.message || message.content || JSON.stringify(message, null, 2));

            // 模拟用户思考时间，然后发送下一条消息
            setTimeout(() => {
                sendNextMessage();
            }, 2000);

        } catch (error) {
            console.log('📨 收到原始消息:', data.toString());
        }
    });

    ws.on('close', () => {
        console.log('🔌 WebSocket连接关闭');
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket错误:', error.message);
        console.log('\n💡 可能的解决方案:');
        console.log('1. 确保Agent服务正在运行: npm start');
        console.log('2. 检查端口3214是否被占用');
        console.log('3. 确认防火墙设置');
    });
}

function sendNextMessage() {
    if (messageIndex < testMessages.length && ws.readyState === WebSocket.OPEN) {
        const message = testMessages[messageIndex];
        console.log(`\n🚀 发送测试消息 ${messageIndex + 1}/${testMessages.length}: ${message}`);

        ws.send(JSON.stringify({
            type: 'user_message',
            content: message
        }));

        messageIndex++;
    } else if (messageIndex >= testMessages.length) {
        console.log('\n🎉 所有测试消息已发送完毕');
        setTimeout(() => {
            ws.close();
            process.exit(0);
        }, 3000);
    }
}

// 启动测试
connectAndTest();

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n👋 测试中断，关闭连接...');
    if (ws) {
        ws.close();
    }
    process.exit(0);
});