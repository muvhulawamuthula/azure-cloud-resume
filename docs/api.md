# API reference

Azure Functions app under api/. Programming model: @azure/functions v4. Runtime: **Node.js 20.x**.

## Endpoint

### GET /api/visitorCounter

| Property | Value |
|----------|--------|
| Auth level | anonymous |
| Methods | GET only |
| Purpose | Atomically (read-modify-write) increment the portfolio visitor counter and return the new value |

On Azure Static Web Apps the Function is reached at the same origin as the site: /api/visitorCounter. Locally (Functions Core Tools) the default base is http://localhost:7071.

### Success — 200

    {
      "count": 42,
      "message": "Persistent visitor counter is working"
    }

| Field | Type | Description |
|-------|------|-------------|
| count | number | Value after increment (or 1 on first create) |
| message | string | Fixed success string |

### Failure — 500

    {
      "message": "Visitor counter failed"
    }

Returned when storage credentials are missing, Table Storage returns a non-404 error, or any other unexpected exception occurs. Details are written via context.error; they are not returned to the client.

## Behavior

1. Resolve table client from env (STORAGE_ACCOUNT_NAME, STORAGE_ACCOUNT_KEY, optional TABLE_NAME).
2. Target entity: partitionKey = "portfolio", rowKey = "visitor-count".
3. If entity exists: count = Number(count || 0) + 1, then updateEntity(..., "Merge").
4. If getEntity returns 404: createEntity with count: 1.
5. Log VisitorCounterRequested with { route, tableName, count, durationMs }.
6. Return 200 + JSON body.

Merge is intentional: updates must not replace the entire entity and wipe unrelated properties.

## Environment variables

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| STORAGE_ACCOUNT_NAME | yes | — | Storage account hosting the table |
| STORAGE_ACCOUNT_KEY | yes | — | Account key for AzureNamedKeyCredential |
| TABLE_NAME | no | VisitorCounter | Table name |
| APPLICATIONINSIGHTS_CONNECTION_STRING | no* | — | Consumed by Functions host for App Insights (*recommended in deployed environments) |

Missing account name or key throws before any Table call; the handler maps that to HTTP 500.

## Dependencies

From api/package.json:

- @azure/functions ^4.0.0
- @azure/data-tables ^13.3.2
- Dev: jest ^29.7.0, azure-functions-core-tools ^4.x

Scripts: npm start → func start; npm test → jest.

## Host configuration

api/host.json: extension bundle [4.*, 5.0.0); Application Insights sampling enabled with excludedTypes: Request.

## Tests

api/test/visitorCounter.test.js loads the Function module after mocking @azure/functions (captures the registered handler) and @azure/data-tables (fake getEntity / updateEntity / createEntity).

Covered cases:

- Increment existing entity → 200, Merge with new count
- Missing/undefined count treated as 0 before increment
- First visit (404) → create with count 1
- Missing storage env vars → 500, no table calls
- Non-404 storage error → 500, no create

Run:

    cd api && npm ci && npm test

These tests are the CI gate in the Static Web Apps workflow before deploy.
