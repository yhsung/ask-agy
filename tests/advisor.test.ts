import { describe, expect, test } from "bun:test";
import { parseAdvisorResponse } from "../src/advisor";

describe("agy response contract", () => {
  test("preserves advice and the conversation reference", () => {
    const result = parseAdvisorResponse(JSON.stringify({
      conversation_id: "review-123", status: "SUCCESS",
      response: "結論：保留既有索引。\n風險：遷移會鎖表。\n",
      duration_seconds: 7, num_turns: 1,
      usage: { input_tokens: 20, output_tokens: 12, thinking_tokens: 8, cache_read_tokens: 0, total_tokens: 32 },
    }));
    expect(result.advice).toBe("結論：保留既有索引。\n風險：遷移會鎖表。");
    expect(result.conversationId).toBe("review-123");
  });

  test("rejects failure status even when a partial answer exists", () => {
    expect(() => parseAdvisorResponse(JSON.stringify({
      status: "ERROR", response: "partial advice", error: "quota exceeded",
    }))).toThrow(/quota exceeded/);
  });

  test("does not mistake invalid output for advice", () => {
    for (const output of ["login required", "{}", "null", "[]", '{"status":"SUCCESS","response":42}']) {
      expect(() => parseAdvisorResponse(output)).toThrow();
    }
  });

  test("rejects a successful envelope with no advice", () => {
    expect(() => parseAdvisorResponse('{"status":"SUCCESS","response":"  \\n"}')).toThrow(/empty/i);
  });
});
