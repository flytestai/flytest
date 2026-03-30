# FlyTest - Intelligent Testing Platform

English | [中文](README.md)

## Overview

FlyTest is an AI-native testing platform for modern QA teams. It covers the full workflow from requirement understanding and knowledge grounding to test design, automation execution, and result tracking. Built with Django REST Framework and Vue 3, FlyTest combines LangGraph, RAG, MCP, and Playwright to help teams create higher-quality test assets faster and run them more efficiently.

## Core Capabilities

- AI Test Case Generation: generate structured test cases from requirements, conversations, API docs, and project context.
- RAG Knowledge Base: parse multi-format documents, build vectorized knowledge, and improve retrieval accuracy with reranking.
- openclaw: extend in-platform intelligent task understanding, tool coordination, and automation orchestration.
- Skills Library: import, manage, and reuse standardized agent skills across projects.
- API Automation: organize API test assets and support AI-assisted generation.
- UI Automation: low-code Playwright-based UI automation with actions, assertions, screenshots, traces, and execution history.
- APP Automation: mobile automation support for Android and iOS workflows.
- AI Security Testing: use AI-assisted analysis to expand security testing coverage and identify potential risks.
- LangGraph Workflows: orchestrate multi-stage intelligent workflows across generation, analysis, execution, and feedback.
- Requirement Review and Test Management: manage projects, requirement review, test cases, test suites, and execution analytics in one platform.

## Tech Stack

- Backend: Django REST Framework, Channels, SimpleJWT, LangChain, LangGraph
- Frontend: Vue 3, Vite, Pinia, Arco Design
- Automation: Playwright, UI Actuator, MCP toolchain
- Knowledge: vector retrieval, reranker support, multi-model integration

## Typical Use Cases

- Generate test cases directly from requirements
- Build project-level knowledge bases for AI-assisted QA workflows
- Manage API, UI, and APP automation assets in one place
- Improve testing efficiency with intelligent workflow orchestration
- Reuse team knowledge through structured skills and automation patterns

## Quick Start

### Docker Deployment

```bash
git clone https://github.com/weixiaoluan/flytest.git
cd flytest
cp .env.example .env
docker compose up -d
```

Default entry:

- Frontend: http://localhost:8913

Default account:

- Username: `admin`
- Password: `admin123456`

## Documentation

- Online docs: https://mgdaaslab.github.io/FlyTest/
- Quick start guide: [docs/QUICK_START.md](./docs/QUICK_START.md)
- GitHub auto-build deployment guide: [docs/github-docker-deployment.md](./docs/github-docker-deployment.md)

## Screenshots

| | |
|---|---|
| ![image](docs/public/img/image-a1.png) | ![image](docs/public/img/image-a2.png) |
| ![image](docs/public/img/image-a3.png) | ![image](docs/public/img/image-a4.png) |
| ![image](docs/public/img/image-a5.png) | ![image](docs/public/img/image-a17.png) |
| ![image](docs/public/img/image-a7.png) | ![image](docs/public/img/image-a8.png) |
| ![image](docs/public/img/image-a9.png) | ![image](docs/public/img/image-a10.png) |
| ![image](docs/public/img/image-a11.png) | ![image](docs/public/img/image-a12.png) |
| ![image](docs/public/img/image-a13.png) | ![image](docs/public/img/image-a14.png) |
| ![image](docs/public/img/image-a15.png) | ![image](docs/public/img/image-a16.png) |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

## Security Notes

- Deploy in a trusted internal or private network whenever possible.
- Avoid exposing the platform directly to the public Internet without proper authentication and access control.
- Apply least-privilege principles when enabling Skills, MCP tools, and automation actuators.

**FlyTest** - Smarter test design, faster test execution.
