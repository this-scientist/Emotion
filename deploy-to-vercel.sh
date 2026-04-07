#!/bin/bash

echo "🚀 部署 Emotion 应用到 Vercel"
echo "========================================"

# 1. 检查是否已安装Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装"
    echo "正在安装 Vercel CLI..."
    npm install -g vercel
    echo "✅ Vercel CLI 已安装"
fi

# 2. 构建前端应用
echo ""
echo "🔨 构建前端应用..."
cd doc-block-viewer
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi
echo "✅ 构建成功"

# 3. 创建部署配置
echo ""
echo "📝 创建部署配置..."
cat > vercel.json << 'EOF'
{
  "version": 2,
  "builds": [
    {
      "src": "dist/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/dist/$1"
    }
  ],
  "env": {
    "VITE_SUPABASE_URL": "https://kvwdkesrirxiuosnublw.supabase.co",
    "VITE_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2d2RrZXNyaXJ4aXVvc251Ymx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDU1ODUsImV4cCI6MjA5MTAyMTU4NX0.u-mk-7ZR3SRuezk_Fm1PAmGrML517QYf9aozH-5cr4k"
  }
}
EOF
echo "✅ 部署配置已创建"

# 4. 部署到Vercel
echo ""
echo "🌐 部署到 Vercel..."
echo ""
echo "请按照以下步骤操作："
echo "1. 访问 https://vercel.com"
echo "2. 点击 'Add New...' → 'Project'"
echo "3. 导入GitHub仓库: this-scientist/Emotion"
echo "4. 选择 'password' 分支"
echo "5. 配置环境变量："
echo "   - VITE_SUPABASE_URL = https://kvwdkesrirxiuosnublw.supabase.co"
echo "   - VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2d2RrZXNyaXJ4aXVvc251Ymx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDU1ODUsImV4cCI6MjA5MTAyMTU4NX0.u-mk-7ZR3SRuezk_Fm1PAmGrML517QYf9aozH-5cr4k"
echo "6. 点击 'Deploy'"

echo ""
echo "📊 部署信息："
echo "Supabase项目: https://kvwdkesrirxiuosnublw.supabase.co"
echo "GitHub仓库: https://github.com/this-scientist/Emotion"
echo "分支: password"
echo "构建目录: doc-block-viewer/dist/"

echo ""
echo "✅ 所有部署准备已完成！"