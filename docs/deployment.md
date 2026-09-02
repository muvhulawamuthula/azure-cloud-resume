# Deployment

## 1. Bootstrap remote state (once)

Terraform state lives in Azure Storage that is **not** created by this configuration:

| Property | Value |
|----------|--------|
| Resource group | tfstate-rg |
| Storage account | muvtfstateresume |
| Container | tfstate |
| State key | azure-cloud-resume.tfstate |
| Auth | Azure AD (use_azuread_auth = true) |

Create that RG/account/container with Azure CLI (or portal) before the first terraform init. Authenticate the CLI / Terraform with a principal that can read/write that container and deploy into the target subscription.

## 2. Apply infrastructure

    cd terraform
    terraform init
    terraform plan
    terraform apply

### Variables

| Variable | Default | Description |
|----------|---------|-------------|
| resource_group_name | azure-cloud-resume-rg | Resource group |
| location | West Europe | Azure region |
| static_web_app_name | azure-cloud-resume | Static Web App name |

Storage account name muvresumevisitorstore and table name VisitorCounter are fixed in main.tf / table resource (not variables).

### Useful outputs

| Output | Notes |
|--------|--------|
| static_web_app_default_hostname | Public site hostname |
| static_web_app_name / resource_group_name | For CLI/portal navigation |
| storage_account_name / visitor_counter_table_name | Counter backend |
| application_insights_connection_string | Sensitive — wire into Function/SWA app settings |

Retrieve the sensitive output with:

    terraform output -raw application_insights_connection_string

### App settings the Function needs

Configure on the Static Web App / managed Function app (Terraform currently **ignores** app_settings on the SWA to avoid clobbering portal/GitHub-driven values):

| Name | Required | Purpose |
|------|----------|---------|
| STORAGE_ACCOUNT_NAME | yes | Table account |
| STORAGE_ACCOUNT_KEY | yes | Account key for AzureNamedKeyCredential |
| TABLE_NAME | no | Defaults to VisitorCounter in code |
| APPLICATIONINSIGHTS_CONNECTION_STRING | recommended | Host to App Insights |

Obtain the storage key from Azure Portal or az storage account keys list.

### GitHub / SWA linking

The SWA resource ignores changes to repository_url, repository_branch, and repository_token. Link the GitHub repo and obtain the deployment API token from the Azure portal (Static Web App, Manage deployment token). Store it as the repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN_MANGO_DESERT_0DEC7B910`.

## 3. GitHub Actions pipeline

File: .github/workflows/azure-static-web-apps-ambitious-forest-0eddb3503.yml

Triggers: push to main; pull_request opened / synchronize / reopened / closed targeting main.

| Job | When | What |
|-----|------|------|
| api_tests_job | push or non-closed PR | Node 20, npm ci, npm test in ./api |
| build_and_deploy_job | same, after tests | SWA upload: app_location=./frontend, api_location=/api, output_location=. |
| close_pull_request_job | PR closed | SWA action: close |

Failures in API tests prevent deploy (needs: api_tests_job).

## 4. Local development

### API unit tests

    cd api
    npm ci
    npm test

Tests mock @azure/functions and @azure/data-tables; they do not require a live Azure account.

### Run the Function locally

    cd api
    export STORAGE_ACCOUNT_NAME=...
    export STORAGE_ACCOUNT_KEY=...
    export TABLE_NAME=VisitorCounter   # optional
    npm start   # func start

Call http://localhost:7071/api/visitorCounter (default Functions port) to verify.

### Frontend

Serve frontend/ with any static file server. For a full local stack including /api routing, use the SWA CLI or point the page at a running Functions host and adjust the fetch URL for local-only work. Production relies on SWA built-in /api proxy to the co-deployed Function.

## 5. Verify production

1. Open https://<static_web_app_default_hostname>/.
2. Confirm Portfolio Views shows a number (not Loading… / Unavailable).
3. Refresh and confirm the count increments.
4. Optionally inspect Application Insights / Log Analytics for VisitorCounterRequested custom logs and request failures.

## 6. Teardown

    cd terraform
    terraform destroy

Remote state storage (tfstate-rg / muvtfstateresume) is outside this stack — delete it separately only when you no longer need state history. Destroying the app removes the visitor table data with the storage account.
