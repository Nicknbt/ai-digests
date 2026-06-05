import OpenAI from 'openai';

function createClient() {
  const opts = {
    timeout: 60000,       // 60s timeout (free tier can be slow)
    maxRetries: 0,        // don't retry on slow responses
  };

  if (process.env.OPENCODE_API_KEY) {
    return new OpenAI({
      ...opts,
      apiKey: process.env.OPENCODE_API_KEY,
      baseURL: process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1',
    });
  }

  return new OpenAI({ ...opts, apiKey: process.env.OPENAI_API_KEY });
}

function defaultModel() {
  if (process.env.OPENCODE_API_KEY) {
    return process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free';
  }
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

export async function generateSummary({ systemPrompt, userPrompt, model }) {
  try {
    const openai = createClient();
    const completion = await openai.chat.completions.create({
      model: model || defaultModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    return completion.choices[0]?.message?.content ?? 'Summary unavailable.';
  } catch (err) {
    console.warn(`openai: ${err.message}`);
    return 'Summary unavailable.';
  }
}

export { defaultModel };
