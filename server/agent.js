import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MemorySaver } from "@langchain/langgraph";
import data from "./data.js";
import { vectorStore, addYTVideoTOVectorStore } from "./embeddings.js";

// await addYTVideoTOVectorStore(data[0]);
// await addYTVideoTOVectorStore(data[1]);

// retrieval tool
const retrievalTool = tool(
  async ({ query }, { configurable: { video_id } }) => {
    const retrievedDocs = await vectorStore.similaritySearch(
      query,
      3,
      { video_id }
    );

    console.log("Retrived docs: -------------------------------");
    console.log(retrievedDocs);

    const serializedDocs = retrievedDocs
      .map((doc) => doc.pageContent)
      .join("\n ");

    return serializedDocs;
  },
  {
    name: "retrieve",
    description:
      "Retrieve the most relevant chunks of text from the transcript of a youtube video",
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

const agent = createAgent({
  model,
  tools: [retrievalTool],
  checkpointer,
});


// testing the agent
const video_id = "lfkjm2YRG-Q";

console.log(
  "Q1: Who helped with the chemistry and sourcing of materials for the fireworks video?",
);
const result1 = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          "Who helped with the chemistry and sourcing of materials for the fireworks video? (based on video transcript)",
      },
    ],
  },
  { configurable: { thread_id: "1", video_id } },
);

console.log(result1.messages.at(-1).content);
