import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MemorySaver } from "@langchain/langgraph";
import { vectorStore } from "./embeddings.js";

// Searches the transcript of the video selected in the UI
const retrievalTool = tool(
  async ({ query }, config) => {
    const video_id = config?.configurable?.video_id;

    const docs = await vectorStore.similaritySearch(query, 5, { video_id });
    const text = docs.map((doc) => doc.pageContent).join("\n\n");

    // Never return an empty string: Cohere rejects empty tool results
    return text || "No relevant excerpts were found in the transcript.";
  },
  {
    name: "retrieve",
    description:
      "Search the transcript of the video the user has selected. Use it for any question about the video's content, topic, speakers, sponsors or takeaways.",
    schema: z.object({
      query: z.string(),
    }),
  },
);

const model = new ChatOpenAI({
  model: "cohere/north-mini-code:free",
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

const checkpointer = new MemorySaver();

export const agent = createAgent({
  model,
  tools: [retrievalTool],
  checkpointer,
  systemPrompt: `You answer questions about the YouTube video the user has selected.
The video is already selected, so never ask the user for a link or video ID.
For any question about the video, call the "retrieve" tool first and answer using only what it returns.
For broad questions such as the main topic or a summary, you may call it more than once with different queries.
If the excerpts don't contain the answer, say you couldn't find it in the transcript.
For greetings and small talk, reply normally without calling any tool.`,
});