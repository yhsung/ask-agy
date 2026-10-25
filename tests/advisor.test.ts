import { parseAskCommand, resolveModelForUser } from "../.omp/extensions/ask-agy";
import {
  ADVISOR_MODELS,
  askAdvisor,
  createAdvisorInvocation,
  parseAdvisorResponse,
  resolveAdvisorModel,
} from "../src/advisor";

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

describe("ask-agy command model selection", () => {
  test("parses --model while preserving the legacy question-only form", () => {
    expect(parseAskCommand("--model gemini-4-argon-medium assess this plan")).toEqual({
      model: "gemini-4-argon-medium",
      question: "assess this plan",
    });
    expect(parseAskCommand("  assess this plan  ")).toEqual({
      question: "assess this plan",
    });
    expect(parseAskCommand("--model gemini-4-argon-medium")).toBeNull();
  });

  test("passes a selected model to the agy child process", async () => {
    let executedArgs: string[] = [];
    await askAdvisor(
      { question: "decision?", context: "evidence" },
      {
        cwd: ".",
        model: "gemini-4-argon-medium",
        execute: async (_command, args) => {
          executedArgs = args;
          return { stdout: '{"status":"SUCCESS","response":"advice"}' };
        },
      },
    );
    expect(executedArgs[executedArgs.indexOf("--model") + 1]).toBe("gemini-4-argon-medium");
  });
});

describe("supported advisor model recovery", () => {
  test("offers the supported model list and continues with the selected model", async () => {
    const result = await resolveAdvisorModel("gemini-4-argon-hi", async (models) => {
      expect(models.some(({ id }) => id === "gemini-4-argon-high")).toBe(true);
      return "gemini-4-argon-medium";
    });
    expect(result).toEqual({ model: "gemini-4-argon-medium" });
  });

  test("reports every supported model when no selector is available", async () => {
    const result = await resolveAdvisorModel("not-a-model");
    expect(result.model).toBeUndefined();
    for (const { id, name } of ADVISOR_MODELS) {
      expect(result.error).toContain(id);
      expect(result.error).toContain(name);
    }
  });

  test("does not launch agy for an invalid model that was not resolved", async () => {
    let launched = false;
    await expect(askAdvisor(
      { question: "decision?", context: "evidence" },
      {
        cwd: ".",
        model: "not-a-model",
        execute: async () => {
          launched = true;
          return { stdout: '{"status":"SUCCESS","response":"unexpected"}' };
        },
      },
    )).rejects.toThrow(/可用模型/);
    expect(launched).toBe(false);
  });
});

  test("limits selection to the supplied model IDs and display names", () => {
    expect(ADVISOR_MODELS).toEqual([
      { id: "gemini-4-argon-medium", name: "Gemini 4 Argon (Medium)" },
      { id: "gemini-4-argon-high", name: "Gemini 4 Argon (High)" },
      { id: "gemini-4-argon-low", name: "Gemini 4 Argon (Low)" },
      { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High)" },
      { id: "gemini-3.8-flash-medium", name: "Gemini 3.8 Flash (Medium)" },
      { id: "gemini-3.8-flash-low", name: "Gemini 3.8 Flash (Low)" },
      { id: "claude-opus-5-5-low", name: "Claude Opus 5.5 (Low)" },
      { id: "claude-opus-5-5-medium", name: "Claude Opus 5.5 (Medium)" },
      { id: "claude-opus-5-5-high", name: "Claude Opus 5.5 (High)" },
      { id: "claude-sonnet-5-5-low", name: "Claude Sonnet 5.5 (Low)" },
      { id: "claude-sonnet-5-5-medium", name: "Claude Sonnet 5.5 (Medium)" },
      { id: "claude-sonnet-5-5-high", name: "Claude Sonnet 5.5 (High)" },
      { id: "gpt-oss-120b-medium", name: "GPT-OSS 120B (Medium)" },
    ]);
  });

describe("model choice interaction", () => {
  test("maps the user's picker choice to a supported model ID", async () => {
    let offered: string[] = [];
    const result = await resolveModelForUser("gemini-4-argon-hi", true, async (_title, choices) => {
      offered = choices;
      return "gemini-4-argon-medium — Gemini 4 Argon (Medium)";
    });
    expect(offered).toContain("gemini-4-argon-medium — Gemini 4 Argon (Medium)");
    expect(result).toEqual({ model: "gemini-4-argon-medium" });
    let cliArgs: string[] = [];
    await askAdvisor(
      { question: "continue?", context: "evidence" },
      {
        cwd: ".",
        model: result.model,
        execute: async (_command, args) => {
          cliArgs = args;
          return { stdout: '{"status":"SUCCESS","response":"done"}' };
        },
      },
    );
    expect(cliArgs[cliArgs.indexOf("--model") + 1]).toBe("gemini-4-argon-medium");
  });

  test("does not show a picker or choose a model without UI", async () => {
    let prompted = false;
    const result = await resolveModelForUser("bad-model", false, async () => {
      prompted = true;
      return "gemini-4-argon-high — Gemini 4 Argon (High)";
    });
    expect(prompted).toBe(false);
    expect(result.model).toBeUndefined();
    expect(result.error).toContain("gemini-4-argon-high");
  });

  test("does not continue when the user cancels model selection", async () => {
    const result = await resolveModelForUser("bad-model", true, async () => undefined);
    expect(result.model).toBeUndefined();
    expect(result.cancelled).toBe(true);
  });
});

