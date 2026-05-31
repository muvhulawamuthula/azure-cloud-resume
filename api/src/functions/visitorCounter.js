const appInsights = require("applicationinsights");

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights
      .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true)
      .start();
}

const telemetryClient = appInsights.defaultClient;

const { app } = require("@azure/functions");
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

const accountName = process.env.STORAGE_ACCOUNT_NAME;
const accountKey = process.env.STORAGE_ACCOUNT_KEY;
const tableName = process.env.TABLE_NAME || "VisitorCounter";

const credential = new AzureNamedKeyCredential(accountName, accountKey);

const client = new TableClient(
    `https://${accountName}.table.core.windows.net`,
    tableName,
    credential
);

app.http("visitorCounter", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const partitionKey = "portfolio";
    const rowKey = "visitor-count";

    const startTime = Date.now();

    try {
      let entity;

      try {
        entity = await client.getEntity(partitionKey, rowKey);
        entity.count = Number(entity.count || 0) + 1;

        await client.updateEntity(entity, "Merge");
      } catch (error) {
        if (error.statusCode === 404) {
          entity = {
            partitionKey,
            rowKey,
            count: 1
          };

          await client.createEntity(entity);
        } else {
          throw error;
        }
      }

      const durationMs = Date.now() - startTime;

      if (telemetryClient) {
        telemetryClient.trackEvent({
          name: "VisitorCounterRequested",
          properties: {
            route: "/api/visitorCounter",
            tableName
          },
          measurements: {
            count: Number(entity.count),
            durationMs
          }
        });

        telemetryClient.trackMetric({
          name: "PortfolioVisitorCount",
          value: Number(entity.count)
        });
      }

      return {
        status: 200,
        jsonBody: {
          count: entity.count,
          message: "Persistent visitor counter is working"
        }
      };
    } catch (error) {
      if (telemetryClient) {
        telemetryClient.trackException({ exception: error });
      }

      context.error("Visitor counter failed", error);

      return {
        status: 500,
        jsonBody: {
          message: "Visitor counter failed"
        }
      };
    }
  }
});