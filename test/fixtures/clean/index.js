import OpenAI from "openai";

const client = new OpenAI();

export async function answer(input) {
  return client.responses.create({
    model: "gpt-5.6-terra",
    input,
  });
}
