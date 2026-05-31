const { app } = require("@azure/functions");
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

function createTableClient() {
  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.STORAGE_ACCOUNT_KEY;
  const tableName = process.env.TABLE_NAME || "VisitorCounter";

  if (!accountName || !accountKey) {
    throw new Error("Missing STORAGE_ACCOUNT_NAME or STORAGE_ACCOUNT_KEY");
  }

  const credential = new AzureNamedKeyCredential(accountName, accountKey);

  return {
    tableName,
    client: new TableClient(
        `https://${accountName}.table.core.windows.net`,
        tableName,
        credential
    )
  };
}

app.http("visitorCounter", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const partitionKey = "portfolio";
    const rowKey = "visitor-count";
    const startTime = Date.now();

    try {
      const { tableName, client } = createTableClient();

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

      // Structured log — flows to Application Insights via the Functions
      // host's built-in integration (APPLICATIONINSIGHTS_CONNECTION_STRING).
      context.log("VisitorCounterRequested", {
        route: "/api/visitorCounter",
        tableName,
        count: Number(entity.count),
        durationMs
      });

      return {
        status: 200,
        jsonBody: {
          count: entity.count,
          message: "Persistent visitor counter is working"
        }
      };
    } catch (error) {
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