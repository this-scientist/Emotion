#!/bin/bash

# 部署脚本
echo "=== 部署 Emotion 项目 ==="

# 1. 构建前端应用
echo "1. 构建前端应用..."
cd doc-block-viewer
npm run build

# 2. 检查构建结果
echo "2. 检查构建结果..."
if [ -d "dist" ]; then
    echo "✅ 构建成功，dist目录已创建"
    echo "   - index.html"
    echo "   - assets目录"
else
    echo "❌ 构建失败"
    exit 1
fi

# 3. 部署选项
echo ""
echo "3. 部署选项："
echo "   a) 手动部署到 Vercel:"
echo "      - 访问 https://vercel.com"
echo "      - 导入GitHub仓库"
echo "      - 配置环境变量："
echo "        VITE_SUPABASE_URL=https://kvwdkesrirxiuosnublw.supabase.co"
echo "        VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2d2RrZXNyaXJ4aXVvc251Ymx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDU1ODUsImV4cCI6MjA5MTAyMTU4NX0.u-mk-7ZR3SRuezk_Fm1PAmGrML517QYf9aozH-5cr4k"
echo ""
echo "   b) 手动部署到 Netlify:"
echo "      - 访问 https://netlify.com"
echo "      - 拖放dist目录或连接GitHub仓库"
echo ""
echo "   c) 部署到 GitHub Pages:"
echo "      - 更新vite.config.ts中的base路径"
echo "      - 运行 npm run build"
echo "      - 将dist目录推送到gh-pages分支"

echo ""
echo "=== 部署信息 ==="
echo "Supabase项目URL: https://kvwdkesrirxiuosnublw.supabase.co"
echo "anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2d2RrZXNyaXJ4aXVvc251Ymx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDU1ODUsImV4cCI6MjA5MTAyMTU4NX0.u-mk-7ZR3SRuezk_Fm1PAmGrML517QYf9aozH-5cr4k"
echo "构建目录: doc-block-viewer/dist/"
echo "GitHub仓库: https://github.com/this-scientist/Emotion"
echo "分支: password"