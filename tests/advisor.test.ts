import { askAdvisor, createAdvisorInvocation, parseAdvisorResponse } from "../src/advisor";

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
describe("agy CLI audit metadata", () => {
  test("records exact CLI flags while redacting prompt contents", () => {
    const invocation = createAdvisorInvocation({
      question: "decision?",
      context: "private evidence",
    });
    expect(invocation.command).toBe("agy");
    expect(invocation.args.slice(0, 8)).toEqual([
      "--mode", "plan",
      "--model", "gemini-4-argon-high",
      "--output-format", "json",
      "--print-timeout", "120s",
    ]);
    expect(invocation.auditArgs.slice(0, 8)).toEqual(invocation.args.slice(0, 8));
    expect(invocation.auditArgs[invocation.auditArgs.indexOf("--print") + 1]).toMatch(
      /^\[redacted prompt; \d+ characters\]$/,
    );
    expect(invocation.auditArgs.join(" ")).not.toContain("private evidence");
  });
});

  test("logs the actual CLI invocation and successful exit without logging the prompt", async () => {
    const logs: Array<{ message: string; details: Record<string, unknown> }> = [];
    let executedArgs: string[] = [];
    await askAdvisor(
      { question: "decision?", context: "private evidence" },
      {
        cwd: ".",
        logger: (message, details) => logs.push({ message, details }),
        execute: async (_command, args) => {
          executedArgs = args;
          return { stdout: '{"status":"SUCCESS","response":"advice"}' };
        },
      },
    );
    expect(logs.map(({ message }) => message)).toEqual([
      "ask-agy: spawning CLI",
      "ask-agy: CLI exited",
    ]);
    expect(logs[0]?.details.args).toEqual(createAdvisorInvocation({
      question: "decision?",
      context: "private evidence",
    }).auditArgs);
    expect(JSON.stringify(logs)).not.toContain("private evidence");
    expect(executedArgs[executedArgs.indexOf("--print") + 1]).toContain("private evidence");
    expect(logs[1]?.details.exitCode).toBe(0);
  });

