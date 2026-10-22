import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MemorySaver } from "@langchain/langgraph";
import data from "./data.js";
import { vectorStore, addYTVideoTOVectorStore } from "./embeddings.js";
import { triggerYoutubeVideoScrape } from "./brightdata.js";

// await addYTVideoTOVectorStore(data[0]);
// await addYTVideoTOVectorStore(data[1]);

const triggerYoutubeVideoScrapeTool = tool(async ({ url })=> {
    console.log('Triggering youtube video scrape', url);
    const snapshotId = await triggerYoutubeVideoScrape(url);
    console.log('Youtube video scrape triggered', snapshotId);
    return snapshotId;
}, {
    name: 'triggerYoutubeVideoScrape',
    description: `Trigger the scraping of a youtube video using the url.
    The tool start a scraping job, that usually takes around 150 seconds
    The tool will return a snapshot/job id, that can be used to check the status of the scraping job
    Use the tool only if the video is not in the vector store already`,
    schema: z.object({
        url: z.string(),
    }),
} );

// retrieval tool
const retrievalTool = tool(
  async ({ query, video_id }, { configurable: {} }) => {
    const retrievedDocs = await vectorStore.similaritySearch(query, 3, {
      video_id,
    });

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
      "Retrieve the most relevant chunks of text from the transcript for a specific youtube video",
    schema: z.object({
      query: z.string(),
      video_id: z.string().describe('The id of the video to retrieve'),
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
  tools: [retrievalTool, triggerYoutubeVideoScrapeTool],
  checkpointer,
  systemPrompt: `You are an assistant that answers questions about a single YouTube video that the user is currently watching.
    The video is already selected, so never ask the user which video they mean or for a link.
    For every question about the video, first call the "retrieve" tool to search its transcript, then answer using only what it returns.
    If the transcript excerpts don't contain the answer, say you couldn't find it in the transcript.`,
});
