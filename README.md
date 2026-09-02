# Azure Cloud Resume

Serverless portfolio site for the [Cloud Resume Challenge](https://cloudresumechallenge.dev/) on Azure: static frontend on Azure Static Web Apps, a Node.js Azure Function visitor counter backed by Table Storage, infrastructure as code with Terraform, and GitHub Actions CI/CD gated on API tests.

**Stack:** Azure Static Web Apps · Azure Functions (Node 20) · Azure Table Storage · Application Insights · Terraform (azurerm ~> 4.0) · GitHub Actions

## Repository layout

| Path | Purpose |
|------|---------|
| `frontend/` | Static site (`index.html`, `styles.css`, `script.js`) and `staticwebapp.config.json` |
| `api/` | Azure Functions app — `visitorCounter` HTTP trigger + Jest unit tests |
| `terraform/` | Resource group, Static Web App, storage account/table, Log Analytics, Application Insights |
| `.github/workflows/` | CI/CD: API tests → Static Web Apps deploy |

## How it works

1. The browser loads the static resume from Azure Static Web Apps.
2. `frontend/script.js` calls `GET /api/visitorCounter` (same-origin under the SWA).
3. The Function reads/increments a single entity in Azure Table Storage (`partitionKey=portfolio`, `rowKey=visitor-count`) and returns `{ count, message }`.

4. Structured logs go to Application Insights when the connection string app setting is present on the Function host.
5. On push or PR to main, GitHub Actions runs API tests, then deploys frontend and api only if tests pass.

## Prerequisites

- Azure subscription and permissions to create resources in the target subscription
- Terraform >= 1.5.0
- Azure CLI (authenticated)
- Node.js 20.x (local API work / tests)
- Azure Functions Core Tools v4 (optional local func start)

Remote Terraform state lives in an out-of-band storage account (tfstate-rg / muvtfstateresume / tfstate container). That store is not managed by this config; bootstrap it once with Azure CLI before the first terraform init.

## Quick start

### Infrastructure

    cd terraform
    terraform init
    terraform plan
    terraform apply

Defaults (overridable via terraform/variables.tf or -var):

- Resource group: azure-cloud-resume-rg
- Location: West Europe
- Static Web App name: azure-cloud-resume
- Storage account: muvresumevisitorstore (fixed in main.tf)
- Table: VisitorCounter

After apply, note outputs such as static_web_app_default_hostname and the sensitive application_insights_connection_string.

Wire Function app settings (via SWA / portal / Azure CLI):

- STORAGE_ACCOUNT_NAME
- STORAGE_ACCOUNT_KEY
- TABLE_NAME (optional; defaults to VisitorCounter)
- APPLICATIONINSIGHTS_CONNECTION_STRING (from Terraform output)

### Local API

    cd api
    npm ci
    npm test
    npm start

### Frontend locally

Open frontend/index.html via any static server. The visitor counter expects /api/visitorCounter; without a local Functions proxy or SWA CLI, the UI shows Unavailable.

### CI/CD

The workflow under .github/workflows/ requires repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN_MANGO_DESERT_0DEC7B910` (deployment token from the Static Web App). Push or open a PR against main to run tests and deploy; closing a PR runs the SWA close job.

## Documentation

- docs/architecture.md — components, data flow, observability
- docs/deployment.md — Terraform, secrets, pipeline, local runs
- docs/api.md — visitorCounter contract, env vars, tests

## License

See LICENSE.
