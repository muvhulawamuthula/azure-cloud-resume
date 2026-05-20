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
  handler: async () => {
    const partitionKey = "portfolio";
    const rowKey = "visitor-count";

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

    return {
      status: 200,
      jsonBody: {
        count: entity.count,
        message: "Persistent visitor counter is working"
      }
    };
  }
});