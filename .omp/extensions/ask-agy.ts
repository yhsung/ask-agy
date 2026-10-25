import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { ADVISOR_MODEL, ADVISOR_MODELS, askAdvisor, resolveAdvisorModel } from "../../src/advisor";

export function parseAskCommand(args: string): { model?: string; question: string } | null {
  const input = args.trim();
  if (!input) return null;
  if (!/^--model(?:\s|$)/.test(input)) return { question: input };

  const rest = input.slice("--model".length).trimStart();
  const separator = rest.search(/\s/);
  if (separator < 1) return null;
  const model = rest.slice(0, separator);
  const question = rest.slice(separator).trim();
  if (!question) return null;
  return { model, question };
}

type ModelPicker = (title: string, choices: string[]) => Promise<string | undefined>;

export async function resolveModelForUser(
  requested: string | undefined,
  hasUI: boolean,
  picker?: ModelPicker,
): Promise<{ model?: string; error?: string; cancelled?: boolean }> {
  return resolveAdvisorModel(requested, hasUI && picker
    ? async (models) => {
        const choices = models.map(({ id, name }) => `${id} — ${name}`);
        const selected = await picker(
          `「${requested}」不是支援的模型，請選擇一個模型以繼續`,
          choices,
        );
        return models.find((model, index) => choices[index] === selected)?.id;
      }
    : undefined);
}

export default function (pi: ExtensionAPI) {
  const z = pi.zod;
  pi.registerCommand("ask-agy", {
    description: "整理證據後，向 AGY 顧問詢問第二意見",
    handler: async (args, ctx) => {
      const parsed = parseAskCommand(args);
      if (!parsed) {
        ctx.ui.notify("用法：/ask-agy [--model <model-name>] <問題>", "warning");
        return;
      }
      const resolution = await resolveModelForUser(
        parsed.model,
        ctx.hasUI,
        (title, choices) => ctx.ui.select(title, choices),
      );
      if (!resolution.model) {
        ctx.ui.notify(resolution.error ?? "無法選擇模型。", "warning");
        return;
      }
      const modelInstruction = parsed.model
        ? `請在 ask-agy 工具的 model 欄位使用 ${JSON.stringify(resolution.model)}。`
        : "";
      pi.sendUserMessage(
        `請先整理相關證據，再呼叫 ask-agy 工具。${modelInstruction}\n問題：${JSON.stringify(parsed.question)}\n收到建議後核實並回覆使用者。`,
        { attribution: "agent" },
      );
    },
  });


  pi.registerTool({
    name: "ask-agy",
    label: "Ask AGY",
    description: [
      `按需向 agy / ${ADVISOR_MODEL} 詢問技術規劃的第二意見；可選模型限於預先定義的支援清單。`,
      "適用於重要方案取捨、高風險或難以逆轉的決策，以及證據互相矛盾、反覆嘗試仍卡住的問題。",
      "先收集相關證據，再提供明確問題與目前方案；一般查詢或明確的小修改不必詢問，也不要每輪呼叫。",
      "只傳必要資訊，不傳憑證、敏感資料或整段對話。",
      "顧問不執行變更，也不是核准者；核實其建議後由你負責決策。失敗時明確回報，不會改用其他模型。",
    ].join(" "),
    parameters: z.object({
      question: z.string().min(1).describe("需要顧問回答的具體問題或決策"),
      model: z.string().min(1).optional().describe("預先定義的 agy 模型 ID；未指定時使用預設模型，無效時可選擇有效模型"),
      context: z.string().min(1).describe("目標、限制、相關原始證據、已嘗試方法與未知；請先移除敏感資料"),
      proposal: z.string().optional().describe("目前建議方案、替代方案及取捨；沒有時可省略"),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const resolution = await resolveModelForUser(
        params.model,
        ctx.hasUI,
        (title, choices) => ctx.ui.select(title, choices),
      );
      if (!resolution.model) {
        return {
          content: [{ type: "text", text: resolution.error ?? "無法選擇模型。" }],
          isError: true,
        };
      }
      const model = resolution.model;
      onUpdate?.({ content: [{ type: "text", text: `詢問 agy / ${model}…` }] });
      const answer = await askAdvisor(params, {
        cwd: ctx.cwd,
        model,
        signal,
        logger: (message, details) =>
          pi.logger.debug(`${message} ${JSON.stringify({ toolCallId, ...details })}`),
      });
      return {
        content: [{ type: "text", text: answer.advice }],
        details: { model, conversationId: answer.conversationId },
      };
    },
  });
}
