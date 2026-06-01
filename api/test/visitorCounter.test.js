// Unit tests for the visitorCounter Azure Function.
//
// The handler is registered via app.http() at module load and builds a fresh
// TableClient per request, so we mock both @azure/functions (to capture the
// handler) and @azure/data-tables (to control the storage responses) before
// requiring the module under test.

const mockGetEntity = jest.fn();
const mockUpdateEntity = jest.fn();
const mockCreateEntity = jest.fn();

let capturedHandler;

jest.mock("@azure/functions", () => ({
  app: {
    http: (_name, options) => {
      capturedHandler = options.handler;
    }
  }
}));

jest.mock("@azure/data-tables", () => ({
  TableClient: jest.fn().mockImplementation(() => ({
    getEntity: mockGetEntity,
    updateEntity: mockUpdateEntity,
    createEntity: mockCreateEntity
  })),
  AzureNamedKeyCredential: jest.fn()
}));

// Requiring the module runs app.http(), which populates capturedHandler.
require("../src/functions/visitorCounter");

function makeContext() {
  return { log: jest.fn(), error: jest.fn() };
}

describe("visitorCounter handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STORAGE_ACCOUNT_NAME = "teststore";
    process.env.STORAGE_ACCOUNT_KEY = "test-key";
    process.env.TABLE_NAME = "VisitorCounter";
  });

  test("increments an existing counter and returns 200", async () => {
    mockGetEntity.mockResolvedValue({
      partitionKey: "portfolio",
      rowKey: "visitor-count",
      count: 41
    });
    mockUpdateEntity.mockResolvedValue({});

    const response = await capturedHandler({}, makeContext());

    expect(response.status).toBe(200);
    expect(response.jsonBody.count).toBe(42);
    expect(mockUpdateEntity).toHaveBeenCalledTimes(1);
    // Must use a Merge so we don't clobber other fields on the entity.
    expect(mockUpdateEntity).toHaveBeenCalledWith(
      expect.objectContaining({ count: 42 }),
      "Merge"
    );
    expect(mockCreateEntity).not.toHaveBeenCalled();
  });

  test("treats a missing/zero count as 0 before incrementing", async () => {
    mockGetEntity.mockResolvedValue({
      partitionKey: "portfolio",
      rowKey: "visitor-count"
      // no count field
    });
    mockUpdateEntity.mockResolvedValue({});

    const response = await capturedHandler({}, makeContext());

    expect(response.status).toBe(200);
    expect(response.jsonBody.count).toBe(1);
  });

  test("creates the entity with count 1 on first visit (404)", async () => {
    mockGetEntity.mockRejectedValue({ statusCode: 404 });
    mockCreateEntity.mockResolvedValue({});

    const response = await capturedHandler({}, makeContext());

    expect(response.status).toBe(200);
    expect(response.jsonBody.count).toBe(1);
    expect(mockCreateEntity).toHaveBeenCalledTimes(1);
    expect(mockCreateEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        partitionKey: "portfolio",
        rowKey: "visitor-count",
        count: 1
      })
    );
    expect(mockUpdateEntity).not.toHaveBeenCalled();
  });

  test("returns 500 when storage account env vars are missing", async () => {
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.STORAGE_ACCOUNT_KEY;
    const ctx = makeContext();

    const response = await capturedHandler({}, ctx);

    expect(response.status).toBe(500);
    expect(response.jsonBody.message).toBe("Visitor counter failed");
    expect(ctx.error).toHaveBeenCalled();
    expect(mockGetEntity).not.toHaveBeenCalled();
  });

  test("returns 500 on a non-404 storage error without creating", async () => {
    mockGetEntity.mockRejectedValue({ statusCode: 503 });
    const ctx = makeContext();

    const response = await capturedHandler({}, ctx);

    expect(response.status).toBe(500);
    expect(response.jsonBody.message).toBe("Visitor counter failed");
    expect(mockCreateEntity).not.toHaveBeenCalled();
    expect(ctx.error).toHaveBeenCalled();
  });
});
