import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const embeddings = new OpenAIEmbeddings({
  model: "liquid/lfm-2.5-embedding-350m:free",
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

export const vectorStore = new MemoryVectorStore(embeddings);

export const addYTVideoTOVectorStore = async (videoData) => {
  const { transcript, video_id } = videoData;

  const docs = [
    new Document({
      pageContent: transcript,
      metadata: { video_id },
    }),
  ];

  //split the video into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitDocuments(docs);

  await vectorStore.addDocuments(chunks);
};
