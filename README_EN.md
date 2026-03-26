# FlyTest - AI-Powered Intelligent Test Case Generation Platform

[![Nerq Trust Score](https://nerq.ai/badge/MGdaasLab/WHartTest)](https://nerq.ai/safe/MGdaasLab/WHartTest)

English | [中文](README.md)

## Overview

FlyTest is an AI-driven test automation platform built on Django REST Framework. Its core capability is generating test cases with AI. The platform integrates LangChain, MCP (Model Context Protocol) tool calling, project management, requirement review, test case management, and advanced knowledge-base management with document understanding. By leveraging large language models and multiple embedding providers (OpenAI, Azure OpenAI, Ollama, etc.), it automatically produces high-quality test cases and uses the knowledge base to provide more accurate testing assistance, delivering a complete intelligent testing management solution for QA teams.

## Platform Features

### AI-Powered Test Case Generation
Based on large language models (LLMs), it transforms requirements into test cases:
- **Multi-source input**: supports requirement documents, conversational input, API docs, and more
- **Structured output**: automatically generates complete cases including steps, preconditions, input data, expected results, and priority (P0-P3)
- **Multi-model support**: integrates OpenAI, Azure OpenAI, Ollama, Xinference, and other embedding services

### Knowledge Base Management and Document Understanding
Build project-level knowledge bases for accurate AI context:
- **Multi-format support**: PDF, Word, Excel, PPT, Markdown, web links, and more
- **Intelligent chunking**: automatic parsing, chunking, and vector storage
- **Semantic retrieval**: precise vector-similarity search
- **Reranker**: configurable reranking models to improve retrieval accuracy

### MCP Tool Integration
Connect AI with testing tools via Model Context Protocol:
- **Browser automation**: integrates Playwright for actions, selectors, screenshots, and recordings
- **Multi-protocol support**: streamable-http, SSE, and more
- **HITL approvals**: sensitive actions require human confirmation
- **Custom extensions**: connect third-party tools and services

### Requirement Review and Risk Analysis
AI-driven requirement quality evaluation to surface risks early:
- **Six-dimension scoring**: completeness, clarity, consistency, testability, feasibility, and logic
- **Issue tracking**: automatically flags ambiguities, conflicts, and omissions
- **Improvement suggestions**: targeted optimizations and testing strategy advice

### Test Case Management
Full lifecycle management for test cases:
- **Multi-level modules**: supports 5-level module hierarchies
- **Case review**: pending, approved, optimized, or invalid status flows
- **Test suites**: flexible case combinations with parallel execution settings
- **Batch operations**: bulk create, edit, move, and delete

### UI Automation Testing
Low-code UI automation to reduce barriers:
- **Multiple locator strategies**: CSS, XPath, Text, Role, Label, and more
- **Visual orchestration**: drag-and-drop steps with conditions, loops, and assertions
- **Environment management**: multi-browser (Chromium/Firefox/WebKit) and environment switching
- **Execution records**: screenshots, videos, Trace, and logs

### Mobile App Automation Testing
Integrated mobile-mcp for mobile automation:
- **Multi-platform support**: Android and iOS
- **Device management**: connection status checks and device info
- **App operations**: install, uninstall, launch, and stop
- **Element interactions**: tap, swipe, input, and gestures
- **Screen operations**: screenshots, recordings, brightness/volume control
- **System operations**: notification shade, permissions, and network switching

### Skill-Based Agent System
Extensible agent skill management framework:
- **Multiple import sources**: ZIP upload and Git repo import
- **SKILL.md spec**: standardized skill descriptors
- **Security isolation**: isolated storage to prevent path traversal
- **Exclusive resources**: join the tech group to access fine-tuned Skills and MCP toolkits

### Execution Reports and Analysis
Comprehensive execution analytics:
- **Real-time monitoring**: live progress and status updates
- **Multi-dimensional stats**: pass rate, duration, and failure analysis
- **Historical comparison**: trend analysis across runs

## Documentation
For full documentation, visit: https://mgdaaslab.github.io/FlyTest/

## Quick Start

### Docker Deployment (Recommended - out of the box)

```bash
# 1. Clone the repo
git clone https://github.com/MGdaasLab/WHartTest.git
cd FlyTest

# 2. Prepare config (use defaults with auto-generated API Key)
cp .env.example .env

# 3. One-command start (choose one of the two)
# Option A: use the deployment script (recommended, auto-selects registry mirrors)
./run_compose.sh

# Option B: use docker-compose directly
docker-compose up -d

# 4. Open the system
# http://localhost:8913 (admin/admin123456)
```

**That's it!** The system will automatically create a default API Key and enable MCP services out of the box.

### Unified Deployment Script

If you use the built-in deployment script, it now asks you to choose between **remote image pull** and **local image build** at startup:

```bash
./run_compose.sh
```

The script now:

- Prompts for a deployment mode: `remote` (pull prebuilt images) or `local` (build locally)
- In `remote` mode, auto-tests built-in registries and lets you pick the fastest (usually just choose `1`)
- `remote` chooses by registry type: Docker Hub uses official / `docker.1panel.live` / `docker.1ms.run` / `docker.xuanyuan.me` / `docker.m.daocloud.io`; GHCR uses official / `ghcr.1ms.run` / `ghcr.nju.edu.cn` / `ghcr.m.daocloud.io`; MCR uses official / `mcr.azure.cn` / `mcr.m.daocloud.io`
- `local` mode auto-detects faster mirrors for `APT / PyPI / npm / Hugging Face`
- Python dependencies now support automatic fallback: prefer the fastest PyPI mirror, then switch to other candidates if a package download times out
- `local` candidates include official, Tsinghua, USTC, Alibaba Cloud, Tencent Cloud, Huawei Cloud, BFSU, Shanghai Jiao Tong, `npmmirror`, `hf-mirror`, and more
- Supports adding your own mirror candidates via environment variables
- Local builds now use Docker cache by default (no longer always `--no-cache`)

Common examples:

```bash
# Interactively choose deployment mode
./run_compose.sh

# Use remote prebuilt images
./run_compose.sh remote

# Build locally and auto-select faster mirrors
./run_compose.sh local

# Force native official sources when building locally
DOCKER_SOURCE_PROFILE=native ./run_compose.sh local

# Force mirror-only selection when building locally
DOCKER_SOURCE_PROFILE=mirror ./run_compose.sh local

# Add custom PyPI candidates (wrap with quotes)
DOCKER_PIP_CANDIDATES_EXTRA="corp|https://pypi.example.com/simple|https://pypi.example.com/simple/pip/" ./run_compose.sh local

# Disable cache only for full local rebuilds
DOCKER_BUILD_NO_CACHE=1 ./run_compose.sh local
```

> ⚠️ **Production note**: Log in to the admin panel, delete the default API Key, and create a new secure key. See: [Quick Start Guide](./docs/QUICK_START.md)

Detailed deployment docs:
- [Quick Start Guide](./docs/QUICK_START.md) - **recommended for new users**
- [GitHub Auto-Build Deployment Guide](./docs/github-docker-deployment.md)
- [Full deployment docs](https://mgdaaslab.github.io/FlyTest/)

## Screenshots

| | |
  |---|---|
  | ![alt text](docs/public/img/image-a1.png) | ![alt text](docs/public/img/image-a2.png) |
  | ![alt text](docs/public/img/image-a3.png) | ![alt text](docs/public/img/image-a4.png) |
  | ![alt text](docs/public/img/image-a5.png) | ![alt text](docs/public/img/image-a17.png) |
  | ![alt text](docs/public/img/image-a7.png) | ![alt text](docs/public/img/image-a8.png) |
  | ![alt text](docs/public/img/image-a9.png) | ![alt text](docs/public/img/image-a10.png) |
  | ![alt text](docs/public/img/image-a11.png) | ![alt text](docs/public/img/image-a12.png) |
  | ![alt text](docs/public/img/image-a13.png) | ![alt text](docs/public/img/image-a14.png) |
  | ![alt text](docs/public/img/image-a15.png) | ![alt text](docs/public/img/image-a16.png) |

## Contributing

1. Fork the project
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

## Contact

For questions or suggestions:
- Open an Issue
- Use the project Discussions
- When adding WeChat, mention `github` so we can add you to the group chat.
- Join the group to get the latest updates and Skills.

<img width="400" alt="image" src="docs/public/img/wx.jpg" />

QQ groups:
1. 8xxxxxxxx0 (full)
2. 1017708746

---

## IMPORTANT SECURITY NOTICE: Skills Permissions and Deployment Safety (v1.4.0 and later)
Because the Skills module has high system execution privileges, please take the following security precautions:

Deployment recommendation: Only deploy in an intranet or trusted private network.
Access control: Do not expose the service to the public Internet or grant access to unauthenticated or untrusted users.
Disclaimer: This project (FlyTest) is for learning and research purposes only. Users are responsible for all security risks and consequences caused by unsafe deployment (such as public exposure or missing authentication). The FlyTest team is not liable for any security incidents, including data leaks or server compromise, caused by improper configuration.

**FlyTest** - AI-powered test case generation that makes testing smarter and development more efficient!
