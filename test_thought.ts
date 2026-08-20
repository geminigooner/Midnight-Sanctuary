import { GoogleGenAI } from '@google/genai';

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContentStream({
    model: 'gemini-2.0-flash-thinking-exp-01-21',
    contents: 'What is 2+2? Think step by step.',
    config: { thinkingConfig: { thinkingBudget: 1024 } }
  });
  
  for await (const chunk of response) {
     console.log(JSON.stringify(chunk.candidates[0].content.parts, null, 2));
     break;
  }
}
main().catch(console.error);
