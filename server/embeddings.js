import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PGVectorStore } from "@langchain/pgvector";

console.log(
  "DB_URL exists:",
  !!process.env.DB_URL
);

const embeddings = new OpenAIEmbeddings({
  model: "liquid/lfm-2.5-embedding-350m:free",
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

let vectorStore;

try {
  vectorStore = await PGVectorStore.initialize(
    embeddings,
    {
      postgresConnectionOptions: {
        connectionString: process.env.DB_URL,
      },
      tableName: "transcripts",
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
      distanceStrategy: "cosine",
    }
  );

  console.log("✅ PGVector connected");
} catch (err) {
  console.error("❌ PGVector initialization failed");
  console.error(err);
  throw err;
}

export { vectorStore };


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
