// AWS Lambda port of the Azure Function visitor counter.
//
// Differences from the Azure version worth knowing:
//  - Storage is DynamoDB instead of Azure Table Storage.
//  - The increment is a single atomic UpdateItem with ADD, so there is no
//    read-modify-write race and no separate "create on 404" path: ADD on a
//    missing item/attribute starts from 0.
//  - No keys in env vars: the Lambda's IAM role grants dynamodb:UpdateItem.
//  - The AWS SDK v3 ships with the Node.js Lambda runtime, so the deployment
//    package is just this one file.

const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

// Created once per execution environment and reused across warm invocations.
const client = new DynamoDBClient({});

const PARTITION_KEY = "portfolio#visitor-count";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

exports.handler = async () => {
  const tableName = process.env.TABLE_NAME;
  const startTime = Date.now();

  try {
    if (!tableName) {
      throw new Error("Missing TABLE_NAME");
    }

    const result = await client.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: { pk: { S: PARTITION_KEY } },
        // "count" is a DynamoDB reserved word, hence the #c alias.
        UpdateExpression: "ADD #c :one",
        ExpressionAttributeNames: { "#c": "count" },
        ExpressionAttributeValues: { ":one": { N: "1" } },
        ReturnValues: "UPDATED_NEW"
      })
    );

    const count = Number(result.Attributes.count.N);

    // Structured JSON log line — queryable in CloudWatch Logs Insights
    // (replaces the Application Insights custom event).
    console.log(
      JSON.stringify({
        event: "VisitorCounterRequested",
        route: "/api/visitorCounter",
        tableName,
        count,
        durationMs: Date.now() - startTime
      })
    );

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        count,
        message: "Persistent visitor counter is working"
      })
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "VisitorCounterFailed",
        error: error && error.message ? error.message : String(error)
      })
    );

    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ message: "Visitor counter failed" })
    };
  }
};
