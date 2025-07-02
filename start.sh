#!/bin/bash

# agent-service/start.sh - 启动脚本

echo "🚀 启动AI Agent服务..."

# 检查Node.js版本
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，请先安装Node.js 16+版本"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js版本过低（当前：$NODE_VERSION），请升级到16+版本"
    exit 1
fi

echo "✅ Node.js版本检查通过: $(node -v)"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

# 检查必要的环境变量
echo "🔧 检查环境配置..."

# 设置默认环境变量
export AGENT_HTTP_PORT=${AGENT_HTTP_PORT:-3213}
export AGENT_WS_PORT=${AGENT_WS_PORT:-3214}
export LLM_API_URL=${LLM_API_URL:-"http://localhost:3212/api/llm"}
export LLM_API_KEY=${LLM_API_KEY:-"test1"}
export LLM_PROVIDER=${LLM_PROVIDER:-"claude"}

echo "📋 配置信息:"
echo "   HTTP端口: $AGENT_HTTP_PORT"
echo "   WebSocket端口: $AGENT_WS_PORT"
echo "   LLM API: $LLM_API_URL"
echo "   API密钥: $LLM_API_KEY"
echo "   LLM提供商: $LLM_PROVIDER"

# 检查依赖服务
echo "🔍 检查依赖服务..."

# 检查LLM服务
echo "   检查LLM服务 ($LLM_API_URL)..."
if curl -s -f "$LLM_API_URL/$LLM_API_KEY/chat/$LLM_PROVIDER" -X POST -H "Content-Type: application/json" -d '{"prompt":"你好！"}' >/dev/null 2>&1; then
    echo "   ✅ LLM服务可用"
else
    echo "   ⚠️ LLM服务暂时不可用，服务仍将启动"
fi

# 检查抖音下载服务
echo "   检查抖音下载服务..."
if curl -s -f "http://localhost:3211/api/health" >/dev/null 2>&1; then
    echo "   ✅ 抖音下载服务可用"
else
    echo "   ⚠️ 抖音下载服务暂时不可用"
fi

# 创建必要的目录
echo "📁 创建工作目录..."
mkdir -p logs
mkdir -p temp

# 检查端口是否被占用
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ 端口 $port 已被占用 ($service)"
        echo "请停止占用进程或修改端口配置"
        exit 1
    fi
}

check_port $AGENT_HTTP_PORT "HTTP服务"
check_port $AGENT_WS_PORT "WebSocket服务"

echo "✅ 端口检查通过"

# 启动服务
echo ""
echo "🎯 启动Agent服务..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 如果是开发模式，使用nodemon
if [ "$NODE_ENV" = "development" ]; then
    echo "🔧 开发模式启动 (使用nodemon)..."
    npm run dev
else
    echo "🚀 生产模式启动..."
    npm start
fi