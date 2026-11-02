// Unit tests for the visitorCounter Lambda.
//
// We mock @aws-sdk/client-dynamodb so DynamoDBClient#send is a jest.fn we
// control, and UpdateItemCommand just records the input it was built with.

const mockSend = jest.fn();

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  UpdateItemCommand: jest.fn().mockImplementation((input) => ({ input }))
}));

const { handler } = require("../src/visitorCounter");

function parse(response) {
  return JSON.parse(response.body);
}

describe("visitorCounter Lambda handler", () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TABLE_NAME = "cloud-resume-visitor-counter";
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("atomically increments the counter and returns 200", async () => {
    mockSend.mockResolvedValue({ Attributes: { count: { N: "42" } } });

    const response = await handler({});

    expect(response.statusCode).toBe(200);
    expect(parse(response).count).toBe(42);
    expect(response.headers["Cache-Control"]).toBe("no-store");
    expect(mockSend).toHaveBeenCalledTimes(1);

    const { input } = mockSend.mock.calls[0][0];
    expect(input).toEqual(
      expect.objectContaining({
        TableName: "cloud-resume-visitor-counter",
        Key: { pk: { S: "portfolio#visitor-count" } },
        UpdateExpression: "ADD #c :one",
        ExpressionAttributeNames: { "#c": "count" },
        ExpressionAttributeValues: { ":one": { N: "1" } },
        ReturnValues: "UPDATED_NEW"
      })
    );
  });

  test("first visit: ADD on a missing item yields 1", async () => {
    mockSend.mockResolvedValue({ Attributes: { count: { N: "1" } } });

    const response = await handler({});

    expect(response.statusCode).toBe(200);
    expect(parse(response).count).toBe(1);
  });

  test("emits a structured log line on success", async () => {
    mockSend.mockResolvedValue({ Attributes: { count: { N: "7" } } });

    await handler({});

    const logged = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logged).toEqual(
      expect.objectContaining({
        event: "VisitorCounterRequested",
        route: "/api/visitorCounter",
        count: 7
      })
    );
    expect(typeof logged.durationMs).toBe("number");
  });

  test("returns 500 when TABLE_NAME is missing", async () => {
    delete process.env.TABLE_NAME;

    const response = await handler({});

    expect(response.statusCode).toBe(500);
    expect(parse(response).message).toBe("Visitor counter failed");
    expect(mockSend).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  test("returns 500 when DynamoDB fails", async () => {
    mockSend.mockRejectedValue(new Error("ProvisionedThroughputExceededException"));

    const response = await handler({});

    expect(response.statusCode).toBe(500);
    expect(parse(response).message).toBe("Visitor counter failed");
    expect(errorSpy).toHaveBeenCalled();
  });
});
