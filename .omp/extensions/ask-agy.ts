import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { ADVISOR_MODEL, askAdvisor } from "../../src/advisor";

export default function (pi: ExtensionAPI) {
  const z = pi.zod;
  pi.registerCommand("ask-agy", {
    description: "整理證據後，向 AGY 顧問詢問第二意見",
    handler: async (args, ctx) => {
      const question = args.trim();
      if (!question) {
        ctx.ui.notify("用法：/ask-agy <問題>", "warning");
        return;
      }
      pi.sendUserMessage(
        `請先整理相關證據，再呼叫 ask-agy 回答以下問題；收到建議後核實並回覆使用者：\n${question}`,
        { attribution: "agent" },
      );
    },
  });

  pi.registerTool({
    name: "ask-agy",
    label: "Ask AGY",
    description: [
      "按需向 agy / Gemini 4 Argon 詢問技術規劃的第二意見。",
      "適用於重要方案取捨、高風險或難以逆轉的決策，以及證據互相矛盾、反覆嘗試仍卡住的問題。",
      "先收集相關證據，再提供明確問題與目前方案；一般查詢或明確的小修改不必詢問，也不要每輪呼叫。",
      "只傳必要資訊，不傳憑證、敏感資料或整段對話。",
      "顧問不執行變更，也不是核准者；核實其建議後由你負責決策。失敗時明確回報，不會改用其他模型。",
    ].join(" "),
    parameters: z.object({
      question: z.string().min(1).describe("需要顧問回答的具體問題或決策"),
      context: z.string().min(1).describe("目標、限制、相關原始證據、已嘗試方法與未知；請先移除敏感資料"),
      proposal: z.string().optional().describe("目前建議方案、替代方案及取捨；沒有時可省略"),
    }),
    async execute(_id, params, signal, onUpdate, ctx) {
      onUpdate?.({ content: [{ type: "text", text: `詢問 agy / ${ADVISOR_MODEL}…` }] });
      const answer = await askAdvisor(params, { cwd: ctx.cwd, signal });
      return {
        content: [{ type: "text", text: answer.advice }],
        details: { model: ADVISOR_MODEL, conversationId: answer.conversationId },
      };
    },
  });
}
