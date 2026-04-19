OpenAI Codex CLI 配置指南
配置后，你可以在 OpenAI Codex CLI 的对话中直接操作 CloudBase 服务。

例如：

"创建用户表" - AI 自动创建数据库集合
"部署这个函数" - AI 自动上传并配置云函数
"部署前端到 CDN" - AI 自动上传文件并配置托管
无需切换到云控制台，所有操作都可以在命令行中用自然语言完成。

前置条件
在开始配置之前，请确保满足以下条件：

已准备好Node.js 环境和云开发环境
Client

OpenAI Codex CLI
配置你的 AI 工具以连接 CloudBase 能力 支持本地与托管两种连接方式，详见 连接方式。

步骤 1：安装 / 配置 CloudBase
前置步骤：

bash

npm i @cloudbase/cloudbase-mcp -g
根据运行系统在终端中运行指令：

MacOS, Linux, WSL:

bash

codex mcp add cloudbase --env INTEGRATION_IDE=CodeX -- cloudbase-mcp
Windows Powershell:

bash

codex mcp add cloudbase --env INTEGRATION_IDE=CodeX -- cmd /c cloudbase-mcp
需要帮助？
查看 OpenAI Codex CLI 文档
步骤 2：和 AI 对话
在 AI 对话中依次输入以下内容:

prompt
安装 CloudBase Skills：命令 npx skills add tencentcloudbase/cloudbase-skills -y

使用 CloudBase Skills： 帮我部署一个 Node.js 后端服务到 CloudBase 云托管


