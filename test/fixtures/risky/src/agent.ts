import OpenAI from "openai";

const client = new OpenAI();

export async function reply(assistantId: string, threadId: string) {
  const assistant = await client.beta.assistants.retrieve(assistantId);
  const run = await client.beta.threads.runs.create(threadId, {
    assistant_id: assistant.id,
    model: "gpt-5.3-chat-latest",
  });

  return run;
}
