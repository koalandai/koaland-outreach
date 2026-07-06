import OpenAI from 'openai';
import { HOTEL_RESEARCH_SYSTEM, hotelResearchUserPrompt } from '../prompts/hotelResearch';
import { DIGITAL_AUDITOR_SYSTEM, digitalAuditorUserPrompt } from '../prompts/digitalAuditor';
import { EMAIL_STRATEGIST_SYSTEM, emailStrategistUserPrompt, FOLLOWUP_WRITER_SYSTEM, followupWriterUserPrompt } from '../prompts/emailStrategist';
import { AI_VISIBILITY_SYSTEM, aiVisibilityUserPrompt } from '../prompts/aiVisibility';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

async function callWithJsonRetry(
  system: string,
  user: string,
  model = 'gpt-4o',
  maxRetries = 2
): Promise<any> {
  const openai = getClient();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

export async function analyzeHotelResearch(data: Parameters<typeof hotelResearchUserPrompt>[0]): Promise<any> {
  const result = await callWithJsonRetry(
    HOTEL_RESEARCH_SYSTEM,
    hotelResearchUserPrompt(data)
  );
  return result.hotelProfile || result;
}

export async function runDigitalAudit(data: Parameters<typeof digitalAuditorUserPrompt>[0]): Promise<any> {
  return callWithJsonRetry(
    DIGITAL_AUDITOR_SYSTEM,
    digitalAuditorUserPrompt(data)
  );
}

export async function runAiVisibilityCheck(data: Parameters<typeof aiVisibilityUserPrompt>[0]): Promise<any> {
  return callWithJsonRetry(
    AI_VISIBILITY_SYSTEM,
    aiVisibilityUserPrompt(data)
  );
}

export async function generateEmailVariants(data: Parameters<typeof emailStrategistUserPrompt>[0]): Promise<any> {
  const result = await callWithJsonRetry(
    EMAIL_STRATEGIST_SYSTEM,
    emailStrategistUserPrompt(data)
  );
  return result.variants || result;
}

export async function generateFollowUp(data: Parameters<typeof followupWriterUserPrompt>[0]): Promise<any> {
  return callWithJsonRetry(
    FOLLOWUP_WRITER_SYSTEM,
    followupWriterUserPrompt(data)
  );
}

export async function checkOpenAIStatus(): Promise<{ ok: boolean; model: string }> {
  try {
    const openai = getClient();
    await openai.models.list();
    return { ok: true, model: 'gpt-4o' };
  } catch {
    return { ok: false, model: 'gpt-4o' };
  }
}
