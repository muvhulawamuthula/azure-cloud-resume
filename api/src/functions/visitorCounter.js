const { app } = require("@azure/functions");

let visitorCount = 0;

app.http("visitorCounter", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    visitorCount++;

    return {
      status: 200,
      jsonBody: {
        count: visitorCount,
        message: "Visitor counter is working"
      }
    };
  }
});