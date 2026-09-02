# Architecture

## Overview

This project is a serverless Cloud Resume Challenge implementation on Azure. The public surface is a static portfolio served by **Azure Static Web Apps (SWA)**. Visitor counts are persisted by a **Node 20 Azure Function** that uses **Azure Table Storage**. Telemetry is collected via **Application Insights** linked to a **Log Analytics** workspace. Provisioning is declarative **Terraform**; delivery is **GitHub Actions** with tests as a hard gate before deploy.

```
Browser
  |  GET /
  v
Azure Static Web App (Free tier)
  |  static: frontend/*
  |  API route: /api/*
  v
Azure Function  visitorCounter  (anonymous GET)
  |  AzureNamedKeyCredential
  v
Storage Account  muvresumevisitorstore
  +-- Table  VisitorCounter
        entity: partitionKey=portfolio, rowKey=visitor-count, count=N

Function host --> Application Insights --> Log Analytics (30-day retention)
```

## Frontend

| Artifact | Role |
|----------|------|
| frontend/index.html | Resume/portfolio markup (about, projects, skills, contact) |
| frontend/styles.css | Layout and presentation |
| frontend/script.js | Fetches visitor count; scroll reveal UI |
| frontend/staticwebapp.config.json | Node 20 API runtime, anonymous routes, security headers, SPA-style 404 to /index.html |

script.js calls fetch("/api/visitorCounter"), expects JSON with a numeric count, and falls back to the label Unavailable on network or non-OK responses. There is no client-side persistence of the counter.

SWA global headers set X-Frame-Options: DENY, X-Content-Type-Options: nosniff, and Referrer-Policy: strict-origin-when-cross-origin.

## API (Azure Functions v4 programming model)

- Runtime: Node.js 20.x (api/package.json engines; SWA apiRuntime: node:20)
- Extension bundle: Microsoft.Azure.Functions.ExtensionBundle [4.*, 5.0.0) (api/host.json)
- Single HTTP function: visitorCounter — GET, authLevel: anonymous
- Client SDK: @azure/data-tables with AzureNamedKeyCredential

Per request the handler builds a TableClient from environment variables, loads or creates the counter entity, increments with a **Merge** update (so other entity fields are not clobbered), and returns HTTP 200 with { count, message } or HTTP 500 with a generic failure body. Structured context.log("VisitorCounterRequested", { route, tableName, count, durationMs }) is intended to flow to Application Insights when the host connection string is configured.

## Persistence

| Setting | Value in repo |
|---------|----------------|
| Storage account name | muvresumevisitorstore (Terraform) |
| Table | VisitorCounter |
| Entity keys | partitionKey = "portfolio", rowKey = "visitor-count" |
| Field | count (number) |

First visit (entity missing / 404) creates { count: 1 }. Subsequent visits read, increment, and Merge-update. Missing STORAGE_ACCOUNT_NAME / STORAGE_ACCOUNT_KEY fails closed with HTTP 500.

## Observability

Terraform provisions:

- azurerm_log_analytics_workspace.resume_logs — PerGB2018, 30-day retention
- azurerm_application_insights.resume_insights — application_type = web, workspace-backed

host.json enables Application Insights sampling (isEnabled: true, excludedTypes: Request). The Function code assumes APPLICATIONINSIGHTS_CONNECTION_STRING is supplied by the hosting environment (SWA-managed Function app settings / portal). The connection string is exposed as a sensitive Terraform output for wiring.

## Infrastructure (Terraform)

Provider: hashicorp/azurerm ~> 4.0, Terraform >= 1.5.0. Backend: azurerm remote state (tfstate-rg / muvtfstateresume / container tfstate / key azure-cloud-resume.tfstate, use_azuread_auth = true). The state store is bootstrapped outside this module to avoid chicken-and-egg destroy issues.

Managed resources (terraform/main.tf):

1. Resource group (var.resource_group_name, default azure-cloud-resume-rg)
2. Static Web App Free tier (var.static_web_app_name, default azure-cloud-resume) — lifecycle.ignore_changes on repository URL/branch/token and app_settings so portal/GitHub linking and app settings are not fought by Terraform
3. Storage account + VisitorCounter table
4. Log Analytics + Application Insights

Tags: project = azure-cloud-resume, managed_by = terraform.

## CI/CD

Workflow job graph on push/PR to main (non-closed PR events):

1. API Tests Job — Node 20, npm ci + npm test in ./api
2. Build and Deploy Job — needs api_tests_job; Azure/static-web-apps-deploy@v1 with app_location: ./frontend, api_location: /api, output_location: .
3. Close Pull Request Job — on PR closed, SWA action: close

Deploy is blocked if Jest fails. Preview environments are the standard SWA PR behavior when the deploy token and GITHUB_TOKEN are present.

## Design notes

- Anonymous counter — intentional for a public resume view count; not an authenticated analytics product.
- Merge updates — preserve entity extensibility and avoid full replace races on unrelated fields.
- Tests gate deploy — keeps broken counter logic off production SWA.
- SWA co-hosts API — frontend uses relative /api/..., avoiding CORS and separate Function app URLs for the happy path.
