# Emotion · folder 分支

## 分支说明

`folder` 分支在 `main` 基础上新增了 **用户系统 + 文件夹管理** 功能，让咨询师可以注册账号、登录，并将历史上传的逐字稿按文件夹整理归档。

---

## 新增功能

### 1. 用户注册 / 登录（`AuthPage.vue`）
- 邮箱 + 密码注册与登录
- 注册时支持填写昵称
- 密码可见性切换
- 友好的中文错误提示（不再使用浏览器原生弹窗）

### 2. 文件夹管理系统（`FileManager.vue`）
- **多级文件夹**：支持嵌套文件夹，面包屑导航
- **新建文件夹**：自定义名称 + 10 种颜色
- **重命名 / 删除**：右上角菜单操作
- **文件移动**：将文件移入指定文件夹
- **文件记录**：上传文档后自动保存至云端，展示文件名 + 最近修改时间

### 3. 路由控制（`App.vue` 改造）
| 状态 | 展示页面 |
|------|---------|
| 未登录 | 登录/注册页 |
| 已登录（无文件） | 文件管理页 |
| 点击文件 | 文档分块预览（编辑器） |
| 点击「上传文件」 | 上传界面（每次都重置）|

### 4. Bug 修复
- **alert() 替换**：文件无内容缓存时，改为页面内红色横幅提示，沙盒/iframe 环境不再被阻断
- **上传跳过 bug**：点击「上传文件」会先清空上次文档状态，确保进入空白上传界面

---

## 数据库设计（Supabase）

### 表结构

```sql
-- 用户档案
profiles (id, username, display_name, avatar_url, created_at, updated_at)

-- 文件夹（支持嵌套）
folders  (id, user_id, parent_id, name, color, description, created_at, updated_at)

-- 用户文件
user_files (id, user_id, folder_id, file_name, original_name,
            file_content, file_meta, blocks_data, mappings_data,
            analysis_data, created_at, updated_at)
```

所有表启用 **Row Level Security（RLS）**，用户只能读写自己的数据。

---

## 接口说明

### Supabase 客户端（`src/lib/supabase.ts`）

```ts
import { supabase } from './lib/supabase'

// 注册
await supabase.auth.signUp({ email, password, options: { data: { display_name } } })

// 登录
await supabase.auth.signInWithPassword({ email, password })

// 退出
await supabase.auth.signOut()

// 查询文件夹
const { data } = await supabase.from('folders').select('*').eq('user_id', userId)

// 查询文件列表
const { data } = await supabase.from('user_files')
  .select('id,file_name,original_name,folder_id,updated_at')
  .eq('user_id', userId)
```

### 环境变量（`.env`）

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 快速启动

```bash
# 安装依赖
cd doc-block-viewer
npm install

# 配置环境变量（复制 .env.example 并填入 Supabase 信息）
cp .env.example .env

# 启动开发服务器
npm run dev
```

---

## 目录结构（新增部分）

```
src/
├── components/
│   ├── AuthPage.vue       # 登录/注册页面
│   └── FileManager.vue    # 文件夹管理主界面
├── lib/
│   └── supabase.ts        # Supabase 客户端 + 类型定义
└── App.vue                # 路由控制（auth/files/editor 三态）
```
