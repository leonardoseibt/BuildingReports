import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_TOKEN || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

export const hasOpenAIKey = !!apiKey;

export const openai = hasOpenAIKey
  ? new OpenAI({ apiKey })
  : null;

export async function simpleCompletion(prompt: string): Promise<string> {
  if (!openai) throw Object.assign(new Error("OpenAI API key not configured"), { status: 500 });
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
