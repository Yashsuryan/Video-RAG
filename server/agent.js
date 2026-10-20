import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import data from "./data.js";

const video1 = data[0];

const docs = [
  new Document({
    pageContent: video1.transcript,
    metadata: { video_id: video1.video_id },
  }),
];

//split the video into chunks
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const chunks = await splitter.splitDocuments(docs);

// console.log(chunks);

// Embed the chunks
const embeddings = new OpenAIEmbeddings({
  model: "liquid/lfm-2.5-embedding-350m:free",
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

const vectorStore = new MemoryVectorStore(embeddings);

await vectorStore.addDocuments(chunks);

// retrieve the most relevant chunks
const retrievedDocs = await vectorStore.similaritySearch('what is science of fireworks?', 1);                   

// console.log("RetrievedDocs: ------------------------------------------");
// console.log(retrievedDocs);

// retrieval tool
const retrievalTool = tool(async ({ query }) => {
    console.log('Retrieving docs for query: -------------------------------------');
    console.log(query);
    const retrievedDocs = await vectorStore.similaritySearch(query, 3);

    const serializedDocs = retrievedDocs.map((doc)=> doc.pageContent).join('\n ');

    return serializedDocs;
}, {
    name: 'retrieve',
    description:'Retrieve the most relevant chunks of text from the transcript of a youtube video',
    schema: z.object({
        query: z.string(),
    }),
});

const model = new ChatOpenAI({
  model: "cohere/north-mini-code:free",
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

const agent = createAgent({
  model,
  tools: [retrievalTool],
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "what is science of fireworks?",
    },
  ],
});

// console.log(result);
console.log(result.messages.at(-1).content);
