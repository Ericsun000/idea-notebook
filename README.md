# 灵感笔记 (Idea Notebook)

随时记录一闪而过的想法，每日整理汇总。一个纯本地、离线可用的 PWA 灵感记录工具。

在线使用: **[ericsun000.github.io/idea-notebook](https://ericsun000.github.io/idea-notebook/)**

## 功能

- **快速记录** — 文字输入，点击展开输入框，失焦自动收缩节省空间
- **智能分类** — 自动分类到工作/生活/学习/创作，自动提取标签
- **标签筛选** — 点击标签快速过滤，支持跨视图叠加筛选
- **AI 增强** — 内置 GLM-4.7 开箱即用，支持接入大模型（DeepSeek/GLM/Qwen/Kimi/本地 Llama），一键生成每日总结、标签校准、深度讨论、项目回顾
- **多模型并存** — 同时连接多个 LLM（如 DeepSeek Flash + DeepSeek Pro），每个功能独立选择模型
- **项目管理** — 创建项目，输入时关联想法到项目，项目级别 AI 总结，讨论时自动附项目上下文
- **每日笔记** — 汇总当天想法，生成结构化笔记
- **时间线** — 按日期浏览所有历史想法
- **回收站** — 软删除 + 3 天自动清除，支持恢复
- **完成标记** — 勾选完成，过滤进行中/已完成
- **自动拆分** — 输入多行编号内容时自动检测并提示拆分
- **深色模式** — 跟随系统自动切换
- **数据迁移** — 一键导出/导入 JSON 备份，换设备无忧
- **自动备份** — 每月自动保存备份文件到本地（需 Chrome/Edge）
- **离线可用** — PWA 安装后可离线使用，修复 Edge 移动端地址栏伸缩视口问题

## 技术栈

| 层面 | 选型 |
|------|------|
| 框架 | Vue 3 (Composition API) |
| 状态管理 | Pinia |
| 路由 | Vue Router (Hash History) |
| 本地数据库 | IndexedDB (via idb) |
| LLM 接口 | 通用 OpenAI 兼容接口 |
| 构建工具 | Vite 6 |
| PWA | vite-plugin-pwa + Workbox |
| 部署 | GitHub Pages |

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 数据存储

所有数据存储在浏览器 IndexedDB 中，完全本地，不需要后端服务器。

- **清除浏览器缓存** 不影响数据
- **清除站点数据** 会导致数据丢失，建议定期导出备份
- 设置页提供导出/导入功能，可一键迁移到新设备

## 大模型接入

支持任意 OpenAI 兼容接口的大模型：

1. 首页右上角点击 AI 图标进入 AI 助手
2. 选择预设模型或自定义 Base URL + API Key + Model ID
3. 支持多个功能：
   - **总结** — 生成每日智能总结
   - **校准** — 修正标签和分类
   - **讨论** — 对每条想法生成深度评论（支持多模型交叉评论）
   - **项目总结** — 基于项目背景和想法列表生成阶段性回顾
4. 可**同时连接多个模型**（如 DeepSeek Flash + DeepSeek Pro），每个功能独立选择使用哪个模型
5. 每个连接可自定义名称以区分

API Key 仅保存在本机 IndexedDB，不上传任何服务器。

### 预设模型

| 模型 | 默认 ID | 备注 |
|------|--------|------|
| DeepSeek | `deepseek-v4-flash` | |
| 智谱 GLM-4.7 | `glm-4.7` | **首次访问自动连接**（内置共享 Key） |
| 通义千问 Qwen3.6 Plus | `qwen-plus` | |
| Kimi K2.6 | `kimi-k2.6` | |
| 本地 Llama / Ollama | 自定义 | |
| LM Studio | 自定义 | |
| 腾讯混元 | `hunyuan-turbos-latest` | 需自定义 URL，注意 CORS 限制 |

### 本地模型支持

支持 LM Studio、Ollama 等本地模型，通过 Vite 代理解决 CORS 问题：

```bash
npm run dev   # 本地开发，代理自动转发到 localhost:1234 (LM Studio) / localhost:11434 (Ollama)
```

> **已知问题**：reasoning 模型（如 qwen3.5-9b）通过 `reasoning_content` 输出，内容清洗尚不完善，总结/讨论质量不稳定。云端模型（DeepSeek、GLM 等）功能正常。
>
> **提示**：LLM 请求默认 120s 超时，超时和 5xx 错误自动重试（最多 2 次，指数退避），适合 GLM 等响应较慢的模型。

## License

MIT
