#!/bin/bash

echo "🚀 部署 Emotion 应用到云端 (类似之前的方式)"
echo "================================================"

# 1. 构建前端应用
echo ""
echo "🔨 构建前端应用..."
cd doc-block-viewer
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi
echo "✅ 构建成功"

# 2. 创建环境变量文件（用于Docker部署）
echo ""
echo "📝 创建环境变量文件..."
cd ..
cat > .env << 'EOF'
# 生产环境配置
VITE_SUPABASE_URL=https://kvwdkesrirxiuosnublw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2d2RrZXNyaXJ4aXVvc251Ymx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDU1ODUsImV4cCI6MjA5MTAyMTU4NX0.u-mk-7ZR3SRuezk_Fm1PAmGrML517QYf9aozH-5cr4k
EOF
echo "✅ 环境变量文件已创建"

# 3. 创建健康检查文件
echo ""
echo "🩺 创建健康检查文件..."
cat > doc-block-viewer/dist/healthz << 'EOF'
OK
EOF
echo "✅ 健康检查文件已创建"

# 4. 生成部署包
echo ""
echo "📦 生成部署包..."
mkdir -p deploy-package
cp -r doc-block-viewer/dist/* deploy-package/
cp Dockerfile deploy-package/
cp nginx.conf deploy-package/
cp docker-compose.yml deploy-package/
cp .env deploy-package/
cp deploy.sh deploy-package/

echo "部署包已创建: deploy-package/"
echo "包含以下文件:"
ls -la deploy-package/

# 5. 创建部署说明
echo ""
echo "📚 部署说明:"
echo ""
echo "方法A: 使用Docker Compose部署"
echo "==============================="
echo "1. 复制整个 deploy-package/ 目录到服务器"
echo "2. 进入目录: cd deploy-package"
echo "3. 启动应用: docker-compose up -d"
echo "4. 应用将在 http://服务器IP:3000 运行"
echo ""
echo "方法B: 直接使用Docker部署"
echo "=========================="
echo "1. 构建镜像: docker build -t emotion-app ."
echo "2. 运行容器: docker run -d -p 3000:80 --name emotion emotion-app"
echo ""
echo "方法C: 使用之前的云IDE平台"
echo "============================"
echo "1. 上传 deploy-package/ 目录到云IDE"
echo "2. 按照平台指导进行部署"
echo ""
echo "🔗 生产环境信息:"
echo "Supabase URL: https://kvwdkesrirxiuosnublw.supabase.co"
echo "前端URL: 部署后访问 http://your-server-ip:3000"
echo ""
echo "✅ 部署包准备完成！"

# 6. 创建一键部署脚本
echo ""
echo "⚡ 创建一键部署脚本..."
cat > deploy-package/start.sh << 'EOF'
#!/bin/bash
echo "启动 Emotion 应用..."
echo "环境变量:"
echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
echo "VITE_SUPABASE_ANON_KEY=$(echo $VITE_SUPABASE_ANON_KEY | head -c 20)..."
docker-compose up -d
echo "应用已启动，访问 http://localhost:3000"
EOF
chmod +x deploy-package/start.sh

echo "✅ 一键部署脚本已创建"