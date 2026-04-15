# Supabase 集成说明

本项目已成功集成 Supabase，提供用户认证和数据存储功能。

## 功能特性

### 1. 用户认证
- 用户注册（邮箱 + 密码）
- 用户登录
- 会话管理
- 自动登录状态保持

### 2. 数据存储
- **profiles** - 用户资料表
  - 用户名、显示名称、头像等
  
- **folders** - 文件夹管理表
  - 支持嵌套文件夹
  - 自定义颜色和描述
  
- **user_files** - 文件存储表
  - 文档内容和元数据
  - 分块数据（JSONB）
  - 映射数据（JSONB）
  - 分析数据（JSONB）

## 配置说明

### 环境变量

项目使用 `.env` 文件存储 Supabase 凭证：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**重要**：
- `.env` 文件已在 `.gitignore` 中，不会被提交到代码仓库
- 请确保 `.env.example` 包含模板配置
- 生产环境部署时需要设置环境变量

### 数据库表结构

#### profiles 表
```sql
- id (uuid) - 关联 auth.users
- username (text) - 用户名，唯一
- display_name (text) - 显示名称
- avatar_url (text) - 头像URL
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### folders 表
```sql
- id (uuid) - 文件夹ID
- user_id (uuid) - 所属用户
- parent_id (uuid) - 父文件夹ID，支持嵌套
- name (text) - 文件夹名称
- color (text) - 文件夹颜色
- description (text) - 文件夹描述
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### user_files 表
```sql
- id (uuid) - 文件ID
- user_id (uuid) - 所属用户
- folder_id (uuid) - 所属文件夹（可选）
- file_name (text) - 文件名
- original_name (text) - 原始文件名
- file_content (text) - 文件内容
- file_meta (jsonb) - 文件元数据
- blocks_data (jsonb) - 分块数据
- mappings_data (jsonb) - 映射数据
- analysis_data (jsonb) - 分析数据
- created_at (timestamptz)
- updated_at (timestamptz)
```

## 使用方法

### 1. 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量（复制模板）
cp .env.example .env

# 编辑 .env 文件，填入你的 Supabase 凭证
# VITE_SUPABASE_URL=https://your-project-id.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key-here

# 启动开发服务器
npm run dev
```

### 2. 用户注册和登录

首次访问应用时，会显示登录/注册界面：
- 选择"登录"或"注册"
- 输入邮箱和密码（注册时还需要用户名）
- 注册后自动登录

### 3. 数据同步

用户的所有数据（文件夹、文件、分块、映射等）会自动同步到 Supabase 数据库。

## 技术实现

### 客户端配置
- **Supabase Client**: 使用 `@supabase/supabase-js` 库
- **单例模式**: 防止创建多个客户端实例
- **类型安全**: 完整的 TypeScript 类型定义

### 认证服务 (`src/services/auth.ts`)
- `signIn()` - 用户登录
- `signUp()` - 用户注册
- `signOut()` - 用户登出
- `getCurrentUser()` - 获取当前用户
- `onAuthStateChange()` - 监听认证状态变化

### 文件服务 (`src/services/fileService.ts`)
- `getFolders()` - 获取文件夹列表
- `createFolder()` - 创建文件夹
- `updateFolder()` - 更新文件夹
- `deleteFolder()` - 删除文件夹
- `getFiles()` - 获取文件列表
- `createFile()` - 创建文件
- `updateFile()` - 更新文件数据
- `deleteFile()` - 删除文件
- `getFileContent()` - 获取文件内容

### UI 组件
- **AuthView.vue** - 登录/注册界面
- **App.vue** - 集成认证流程的主应用

## 安全特性

1. **行级安全策略 (RLS)**
   - 所有表都启用了 RLS
   - 用户只能访问自己的数据

2. **认证流程**
   - 使用 Supabase Auth 进行用户认证
   - 支持邮箱密码认证
   - 会话自动刷新

3. **环境变量隔离**
   - 敏感凭证存储在环境变量中
   - 不暴露在客户端代码中

## 部署说明

### Cloud Studio 部署

1. 在 Cloud Studio 中设置环境变量：
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

2. 部署 `dist` 目录

3. 访问部署的 URL

### 注意事项

- 确保在生产环境使用环境变量而不是硬编码凭证
- 定期备份 Supabase 数据库
- 监控 API 使用量和配额
- 为生产环境配置适当的 RLS 策略

## 故障排查

### 连接问题
- 检查 `.env` 文件中的凭证是否正确
- 确认 Supabase 项目状态为 Active
- 检查网络连接

### 认证问题
- 确认邮件验证设置
- 检查 Supabase Auth 配置
- 查看浏览器控制台错误信息

### 数据同步问题
- 检查 RLS 策略配置
- 确认用户 ID 匹配
- 查看 Supabase 日志

## 后续开发计划

- [ ] 实现文件夹管理界面
- [ ] 实现文件列表和云端文件选择
- [ ] 添加数据导出功能
- [ ] 实现离线模式支持
- [ ] 添加数据同步冲突解决
