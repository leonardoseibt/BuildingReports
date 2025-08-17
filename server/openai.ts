// OpenAI client is optional in dev environments. Import lazily to avoid TypeScript errors when dependency is not installed.
let OpenAI: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  OpenAI = require("openai").default || require("openai");
} catch (e) {
  // dependency not installed — keep module optional
}

const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_TOKEN || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

export const hasOpenAIKey = !!apiKey && !!OpenAI;

export const openai = hasOpenAIKey && OpenAI ? new OpenAI({ apiKey }) : null;

export async function simpleCompletion(prompt: string): Promise<string> {
  if (!openai) throw Object.assign(new Error("OpenAI API key not configured"), { status: 500 });
  // Use the modern client shape if available, fallback to older create API
  // Note: This is a best-effort shim for development environments.
  if (openai.chat && openai.chat.completions && typeof openai.chat.completions.create === "function") {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um assistente útil." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 256,
    });
    return res.choices?.[0]?.message?.content || "";
  }

  if (typeof openai.createChatCompletion === "function") {
    const res = await openai.createChatCompletion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um assistente útil." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 256,
    });
    return res.data?.choices?.[0]?.message?.content || "";
  }

  throw new Error("OpenAI client API not recognized");
}
