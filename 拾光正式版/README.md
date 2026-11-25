# 拾光 · 学生任务台 1.0

一个面向大学生的单机任务与消息管理网页。无需安装、无需后端，双击 `index.html` 即可使用。

## 打开方式

1. 双击 `index.html`，用 Chrome、Edge、Safari 或 Firefox 打开。
2. 也可以把整个文件夹放到任意位置；不要只移动 `index.html`，请保留 `css/`、`js/`、`assets/` 目录。
3. 数据保存在当前浏览器的 localStorage 中，不会上传服务器。
4. 换浏览器、换电脑或清理浏览器数据前，请在「统计 · 设置 → 数据与备份」导出 JSON 备份。
5. 如果所用浏览器限制本地文件的 localStorage，请优先使用 Chrome / Edge 双击打开；仍不可用时，可在本目录启动任意静态服务器访问。

## 目录结构

```text
拾光正式版/
├─ index.html          # 页面骨架
├─ css/
│  └─ style.css        # 全部界面样式
├─ js/
│  ├─ storage.js       # 存储层：只负责 localStorage 读写
│  └─ app.js           # 程序层：业务逻辑与界面渲染
├─ assets/
│  └─ icon.svg         # 站点图标
└─ README.md
```

程序层与存储层已经拆开：`js/storage.js` 是唯一直接接触 localStorage 的文件，`js/app.js` 只通过 `window.ShiGuangStorage` 调用它。以后要换存储方式（例如 IndexedDB），只需要改 `storage.js`。

## 功能

- 今日仪表盘、完成进度、冲突提醒、未来 3 天 DDL
- 快速捕获与自然语言解析，AI 增强可选
- 任务列表、看板、四象限、智能排序
- 任务列表多选、全选当前结果与批量删除
- 任务类型：普通任务 / 事件 / 日程
- 紧急度自动判断 + 重要度手动设置
- 月历、时间轴、24 小时日视图、空闲时间识别
- 消息收件箱、转任务、关联任务
- JSON / CSV / ICS 导入导出、浏览器提醒
- 智能识图：上传课程表、考试安排或群通知截图，AI 只提议，用户勾选确认后批量导入

## AI 与隐私

AI 功能是可选的。需要在「统计 · 设置」中添加支持 Chat Completions 的 API Key；智能识图还需要模型支持图片输入。

API Key、任务、消息、作息设置都只保存在本机浏览器。图片只在本次识别时发送到用户自己配置的 AI 接口，不写入 localStorage。

## 兼容性

建议使用近两年的 Chrome、Edge、Safari 或 Firefox。没有网络、没有 API Key 时，除 AI 相关功能外都可以正常使用。
