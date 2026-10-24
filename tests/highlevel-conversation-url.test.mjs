import { test } from "node:test";
import assert from "node:assert/strict";

import { highLevelConversationUrl, safeHighLevelConversationUrl } from "../src/lib/orders/highlevel-conversation-url.ts";

test("construye la ruta directa válida al inbox de HighLevel", () => {
  const url = highLevelConversationUrl("location 1", "conversation/1");

  assert.equal(
    url.toString(),
    "https://app.iaorbita.com/v2/location/location%201/conversations/conversations/conversation%2F1?category=team-inbox&tab=all",
  );
});

test("corrige enlaces antiguos que usaban conversation en singular", () => {
  const url = safeHighLevelConversationUrl(
    "https://app.iaorbita.com/v2/location/location-1/conversations/conversation/conversation-1",
  );

  assert.equal(
    url?.toString(),
    "https://app.iaorbita.com/v2/location/location-1/conversations/conversations/conversation-1?category=team-inbox&tab=all",
  );
});

test("rechaza enlaces externos", () => {
  assert.equal(safeHighLevelConversationUrl("https://example.com/conversations/conversations/1"), undefined);
});
