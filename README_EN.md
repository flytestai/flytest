# FeiCe 飞测

An AI-assisted testing platform for QA teams, connecting requirement reviews, test design, test assets, defect tracking, and API / Web / APP automation.

[中文](./README.md) · [Quick start](#quick-start) · [Screenshots](#screenshots) · [Development and verification](#development-and-verification)

> The product brand is **FeiCe**. Historical `FlyTest_*` directory names, service names, and some environment variables remain for compatibility.

## Capabilities

| Area | Current scope |
| --- | --- |
| Quality workspace | Test asset totals, pass rate, pending defects, execution trends, backlog, defect risks, automation matrix, review distribution, and token usage |
| Requirements | Document upload, splitting, reviews, specialized analysis, and reports |
| AI and knowledge | LangGraph conversations, LLM configuration, prompts, tool approvals, knowledge retrieval, and Skills |
| Test assets | Cases, modules, suites, bugs, execution history, reports, templates, and data factory |
| API automation | Collections, requests, test cases, environments, execution records, and reports |
| Web / UI automation | Pages, steps, cases, AI mode, execution records, batch runs, shared data, environments, and actuators |
| APP automation | Devices, packages, elements, scene builder, cases, suites, execution records, scheduled tasks, notification logs, and reports |
| Collaboration and extensions | Projects, users, organizations, permissions, operation logs, notifications, API keys, remote MCP, and Skills management |

AI, vector retrieval, and device execution require the corresponding models, services, and devices to be configured.

## Screenshots

The current A2 workspace uses a shared FeiCe identity, bright blue actions, rounded cards, compact filters and tables, responsive navigation, and dark theme support.

These browser screenshots show the current code with isolated demonstration API fixtures. Sample statistics illustrate supported UI states; they are not production metrics or a claim that every statistics field is already supplied by the backend.

| Login | Quality workspace |
| --- | --- |
| ![FeiCe login](./.github/readme-assets/a2-login.png) | ![FeiCe quality workspace](./.github/readme-assets/a2-dashboard.png) |

| Test cases | API test report |
| --- | --- |
| ![FeiCe test cases](./.github/readme-assets/a2-testcases.png) | ![FeiCe API report](./.github/readme-assets/a2-api-report.png) |

| Web / UI automation | APP device management |
| --- | --- |
| ![FeiCe Web automation](./.github/readme-assets/a2-ui-automation.png) | ![FeiCe APP devices](./.github/readme-assets/a2-app-devices.png) |

<details>
<summary>Mobile layout</summary>

<img src="./.github/readme-assets/a2-mobile.png" width="320" alt="FeiCe mobile quality workspace" />

</details>

Quality colors are shared across the UI: action blue `#0066FF`, pass green `#008000`, and risk red `#E00000`. A pass rate is green only when its unrounded value is exactly **100%**. Pending defects are red; coverage is green at **80% or above**, otherwise red. Execution bars use green for passed results and red for failures. Missing data uses an empty state. The dashboard displays unavailable coverage when Django statistics do not supply it, rather than estimating it from unrelated asset counts.

## Repository and stack

| Directory | Responsibility |
| --- | --- |
| `FlyTest_Vue/` | Vue 3.5, TypeScript 5.8, Vite 6, Pinia, Arco Design Vue |
| `FlyTest_Django/` | Django 5.2, DRF, SimpleJWT, Channels / ASGI, core business APIs |
| `FlyTest_FastAPI_AppAutomation/` | Independent FastAPI APP automation service |
| `FlyTest_Actuator/` | Playwright UI actuator connected through WebSocket |
| `FlyTest_MCP/` | MCP testing tools |
| `FlyTest_Skills/` | Bundled Skills |
| `docs/` | Product, deployment, development, and verification documentation |
| `deploy/`, `deploy-scripts/` | Deployment configuration and scripts |

Additional infrastructure includes LangChain / LangGraph, Qdrant, Celery / Redis, and PostgreSQL or SQLite for the main backend.

## Quick start

### Build the current source with Docker

Requirements: Git, Docker, and Docker Compose.

```bash
git clone https://github.com/flytestai/flytest.git
cd flytest
cp .env.example .env
# Edit .env: configure secrets, administrator credentials, and database settings
docker compose -f docker-compose.local.yml up -d --build
```

In PowerShell, use `Copy-Item ".env.example" ".env"` to copy the example. The root `.env` provides Compose substitutions; local Django development uses `FlyTest_Django/.env` separately.

Use `docker-compose.local.yml` to build project services from the checked-out source. The default `docker-compose.yml` mixes prebuilt images and local builds; its prebuilt images may not contain the latest changes on `main`.

| Service | Default host entry |
| --- | --- |
| Frontend | http://localhost:8913 |
| Django API | http://localhost:8912/api/ |
| Redis | `localhost:8911` |
| FeiCe MCP | `localhost:8914` |
| MS MCP, configured as needed | `localhost:8915` |
| Playwright MCP | `localhost:8916` |
| Qdrant | `localhost:8918` |
| PostgreSQL | `localhost:8919` |

APP automation runs on container port `8010`, accessed through the frontend `/api/app-automation/` proxy. No separate host port is exposed by default.

The container startup creates an administrator using `DJANGO_ADMIN_USERNAME` and `DJANGO_ADMIN_PASSWORD`. Use the values configured in `.env`; if variables are absent, Compose falls back to `admin` / `admin123456`.

### Local development

Python 3.11 and Node.js 20 match the repository's Docker build environment. Start each service in a separate terminal, from the repository root. Use separate Python virtual environments for independent services.

Django setup in PowerShell:

```powershell
cd "FlyTest_Django"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
Copy-Item ".env.example" ".env"
python -m pip install -r requirements.txt
```

On Linux / macOS, activate with `source .venv/bin/activate` and copy with `cp .env.example .env`. Edit the Django `.env`: use `DATABASE_TYPE=sqlite` for a basic local setup, or configure a reachable PostgreSQL server for the default `postgres` mode.

```bash
python manage.py migrate
python manage.py createsuperuser
python -m uvicorn flytest_django.asgi:application --host 127.0.0.1 --port 8000 --reload
```

ASGI supports WebSocket connections. Local startup does not run the container administrator initialization; create the administrator explicitly.

Frontend, in another terminal:

```bash
cd FlyTest_Vue
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open http://127.0.0.1:5173/login . Vite proxies `/api/` and `/media/` to Django on `8000`, `/ws/` to its WebSocket endpoint, and `/api/app-automation/` to FastAPI on `8010`. Override targets through process environment variables `VITE_PROXY_TARGET`, `VITE_WS_PROXY_TARGET`, and `VITE_APP_AUTOMATION_PROXY_TARGET`.

Optional services:

- Start Redis and Qdrant from the repository root with `docker compose -f docker-compose.local.yml up -d redis qdrant`. Set Django's broker/result backend to `redis://127.0.0.1:8911/0` and Qdrant to `http://127.0.0.1:8918`. Knowledge retrieval also requires model configuration.
- For shared WebSocket state across processes, set `CHANNEL_REDIS_URL=redis://127.0.0.1:8911/1`.
- Run `celery -A flytest_django worker -l info -Q celery,ui_automation` in the Django environment. Windows local debugging can append `--pool=solo`. Include any custom UI queue in `-Q`. Start `celery -A flytest_django beat -l info` separately for scheduled tasks.
- For APP automation, create and activate a separate environment in `FlyTest_FastAPI_AppAutomation/`, install `requirements.txt`, set `APP_AUTOMATION_JWT_SECRET` to Django's actual `DJANGO_SECRET_KEY`, then run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8010 --reload`. See the [APP service README](./FlyTest_FastAPI_AppAutomation/README.md) for devices and optional OCR dependencies.
- Configure UI actuators and MCP tools using the [actuator README](./FlyTest_Actuator/README.md) and [MCP README](./FlyTest_MCP/README.md).

## Development and verification

In `FlyTest_Vue/`:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 5176
```

The build performs Vue / TypeScript checking and generates `dist/`. Preview inherits the proxies from the current configuration and still requires the corresponding backend services for API access. Use Nginx / Docker for deployment.

Browser verification requires an available Playwright package and browser. Playwright is separate from production dependencies: install temporarily with `npm install --no-save --package-lock=false playwright`, or set `PLAYWRIGHT_MODULE` to an existing package path. With installed Edge:

```powershell
$env:UI_BASE_URL = "http://127.0.0.1:5173"
$env:UI_BROWSER_CHANNEL = "msedge"
npm run test:layout
npm run test:layout:interactions
npm run test:auth
npm run test:dashboard
npm run test:quality
node scripts/verify-a2-details.cjs
```

Start the frontend first. `UI_BASE_URL` unifies differing script default ports. To use Playwright Chromium, unset the browser channel and run `npx playwright install chromium`.

The scripts intercept API calls in isolated browser contexts without writing to the business database. Reports and screenshots go to the ignored `playwright-screenshots/` directory. Fixtures do not replace real permissions, model, device, or integration acceptance tests. The latest A2 record includes 138 layout checks across 46 entries at 1440 / 1024 / 390px, plus 320px, dialogs, authentication, quality thresholds, and interaction checks.

## Documentation

- [Documentation index](./docs/index.md) · [Quick start](./docs/QUICK_START.md)
- [Frontend](./FlyTest_Vue/README.md) · [Browser verification](./FlyTest_Vue/scripts/README-layout.md)
- [Django backend](./FlyTest_Django/README.md) · [APP service](./FlyTest_FastAPI_AppAutomation/README.md)
- [Actuator](./FlyTest_Actuator/README.md) · [MCP](./FlyTest_MCP/README.md)
- [GitHub / Docker deployment](./docs/github-docker-deployment.md) · [UI AI queue](./docs/UI_AI_QUEUE.md)
- [A2 implementation](./docs/plans/2026-10-30-feice-a2-frontend.md) · [A2 verification record](./docs/plans/2026-10-30-feice-a2-verification.md)

## License and deployment configuration

Licensed under [PolyForm Noncommercial 1.0.0](./LICENSE). Refer to the license text for permitted uses and distribution terms.

Before external deployment, replace example secrets, administrator passwords, and API keys, and review HTTPS, cookies, allowed hosts, and cross-origin settings. Some Compose development settings are hardcoded; editing the root `.env` alone does not guarantee every production setting takes effect. Inspect the actual Compose configuration and deployment documentation.
