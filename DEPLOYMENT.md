# 部署指南

## 已完成的工作

1. ✅ 数据库迁移已应用到云端Supabase
2. ✅ 前端应用已构建成功
3. ✅ 代码已推送到GitHub (password分支)

## 下一步：部署到生产环境

### 1. 获取生产环境Supabase密钥

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 进入 "Emotion" 项目
3. 点击左侧边栏的 **Settings** → **API**
4. 复制以下信息：
   - **Project URL**: `https://kvwdkesrirxiuosnublw.supabase.co`
   - **anon/public key**: 以 `sb_publishable_` 开头的密钥

### 2. 更新生产环境配置

更新 `doc-block-viewer/.env.production` 文件：

```bash
VITE_SUPABASE_URL=https://kvwdkesrirxiuosnublw.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ACTUAL_PRODUCTION_ANON_KEY
```

### 3. 构建生产版本

```bash
cd doc-block-viewer
npm run build
```

构建产物将在 `dist/` 目录中。

### 4. 部署前端应用

选择以下任一平台部署：

#### **Vercel** (推荐)
1. 访问 [vercel.com](https://vercel.com)
2. 导入GitHub仓库
3. 配置环境变量：
   - `VITE_SUPABASE_URL`: 您的Supabase项目URL
   - `VITE_SUPABASE_ANON_KEY`: 您的生产环境anon key
4. 部署

#### **Netlify**
1. 访问 [netlify.com](https://netlify.com)
2. 拖放 `dist/` 文件夹或连接GitHub仓库
3. 在站点设置中添加环境变量

#### **GitHub Pages**
1. 在 `vite.config.ts` 中设置正确的base路径
2. 运行 `npm run build`
3. 将 `dist/` 目录推送到GitHub Pages分支

### 5. 验证部署

1. 访问您的前端应用URL
2. 测试登录功能
3. 测试文件上传和加密功能
4. 验证安全文件功能正常工作

## 技术详情

### 已部署的数据库迁移

1. **20260407090000_initial_schema.sql** - 初始数据库结构
2. **20260407120000_secure_user_files.sql** - 安全文件加密功能：
   - 将 `user_files.file_content` 转换为 `jsonb` 格式
   - 创建 `user_encryption_keys` 表
   - 启用行级安全性（RLS）

### 备份文件

数据库迁移前的备份：`backup_before_migration.sql`

## 故障排除

### 数据库连接问题
- 检查Supabase项目是否激活
- 验证API密钥是否正确
- 检查网络防火墙设置

### 前端构建问题
- 确保Node.js版本 >= 16
- 运行 `npm install` 更新依赖
- 检查环境变量配置

## 后续步骤

1. 合并 `password` 分支到主分支
2. 设置持续集成/持续部署（CI/CD）
3. 配置自定义域名
4. 设置SSL证书
5. 监控和日志记录