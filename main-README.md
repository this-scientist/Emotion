# Emotion · main 分支

## 项目简介

**Emotion** 是一款专为心理咨询师设计的逐字稿分析工具。上传咨询录音转写的文字稿后，可对对话内容进行分块标注、角色映射，并在逐字稿中内嵌结构化表格，记录每个干预片段的意图、技术和有效性评分，最终导出为 Word 文档。

## 🌐 在线预览

**最新版本**: [点击访问](http://9c3e2cdaad80487aafbb2183ba4131d2.codebuddy.cloudstudio.run)

> 提示：在线版本为演示环境，数据仅保存在本地浏览器中。

---

## 核心功能

### 1. 文档上传与解析
- 支持 `.docx`、`.txt` 格式
- 自动逐行解析，保留原始段落结构

### 2. 内容分块（`BlockPanel`）
- 鼠标框选文本行，命名并标色
- 多个块可独立管理（编辑、删除、颜色修改）
- 滚动标记条：右侧显示块在全文中的位置分布

### 3. 角色映射（`MappingDialog`）
- 为块内对话指定说话人角色（咨询师 / 来访者）
- 支持按前缀（如"T："、"C："）批量识别

### 4. 映射视图与表格标注（`MappingView`）
- 彩色区分咨询师（紫色）/ 来访者（蓝色）对话
- 悬停段落 → 点击「+」在任意行后插入分析表格
- 表格字段：
  - 助人者意图（19 种，来自 Hill 模型）
  - 助人技术（12 大类含细分，共 19 条）
  - 有效性 5 点评分（咨询师 / 来访者双视角）
  - 来访者反应
  - 更好的干预方式
- 多行表格支持（同一位置可添加多条标注）
- 文本行就地编辑

### 5. 导出为 Word（`.docx`）
- 保留对话结构与角色样式
- 内嵌的分析表格一同导出
- 文件名自动以块名称命名

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端框架 | Vue 3 + TypeScript + Vite |
| UI 样式 | Tailwind CSS |
| 图标 | Lucide Vue Next |
| 文档解析 | mammoth（docx → 文本）|
| Word 导出 | docx.js |
| 本地持久化 | localStorage |

---

## 快速启动

```bash
# 克隆仓库
git clone https://github.com/this-scientist/Emotion.git
cd Emotion/doc-block-viewer

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

访问 `http://localhost:5173` 即可使用。

---

## 使用流程

```
上传文件 → 框选分块 → 角色映射 → 映射视图
                                    ↓
                              插入分析表格
                                    ↓
                              导出 Word 文档
```

---

## 分支说明

| 分支 | 功能 | README |
|------|------|--------|
| `main` | 核心文档分析工具（本分支） | main-README.md |
| `folder` | + 用户注册/登录 + 文件夹管理系统 | folder-README.md |
| `agent` | + AI 督导分析（5 种 Agent + 报告下载） | agent-README.md |

---

## 目录结构

```
doc-block-viewer/
├── src/
│   ├── components/
│   │   ├── FileUploader.vue     # 文件上传
│   │   ├── DocPreview.vue       # 文档预览 + 框选分块
│   │   ├── BlockPanel.vue       # 块管理面板
│   │   ├── ScrollMarker.vue     # 右侧滚动标记条
│   │   ├── BlockEditor.vue      # 块命名/颜色弹窗
│   │   ├── MappingDialog.vue    # 角色映射弹窗
│   │   ├── MappingView.vue      # 映射视图 + 内联表格编辑
│   │   └── TableEditor.vue      # 表格编辑器组件
│   ├── composables/
│   │   └── useBlockManager.ts  # 分块状态管理
│   ├── data/
│   │   └── tableData.ts        # 意图 / 技术 数据表
│   ├── services/
│   │   └── docParser.ts        # 文档解析服务
│   ├── utils/
│   │   ├── exportDocx.ts       # Word 导出工具
│   │   ├── extractSpeakers.ts  # 角色映射工具
│   │   └── storage.ts          # localStorage 持久化
│   └── types/
│       └── block.ts            # ContentBlock 类型定义
└── package.json
```
