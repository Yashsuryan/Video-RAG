import express from "express";
import cors from "cors";
import { agent } from "./agent.js";
import { vectorStore, addYTVideoTOVectorStore } from "./embeddings.js";
import { triggerYoutubeVideoScrape } from "./brightdata.js";

// Keep the server alive if the database connection drops
process.on("uncaughtException", (err) =>
  console.error("Uncaught exception:", err.message),
);
process.on("unhandledRejection", (err) =>
  console.error("Unhandled rejection:", err),
);

const port = process.env.PORT || 3000;

const app = express();

app.use(express.json({ limit: "200mb" }));
app.use(
  cors({
    origin: [
      "https://client-omega-hazel-63.vercel.app",
      "http://localhost:5173",
    ],
  }),
);

app.get("/", (req, res) => {
  res.send("hello world");
});

// Videos whose scrape has started but isn't indexed yet
const indexing = new Set();

const isIndexed = async (video_id) => {
  const docs = await vectorStore.similaritySearch("video", 1, { video_id });
  return docs.length > 0;
};

app.post("/generate", async (req, res) => {
  const { query, video_id, thread_id } = req.body;
  console.log({ query, video_id, thread_id });

  try {
    if (!(await isIndexed(video_id))) {
      if (indexing.has(video_id)) {
        return res.json({
          content:
            "I'm still processing this video. Please try again in a minute or two.",
        });
      }

      await triggerYoutubeVideoScrape(
        `https://www.youtube.com/watch?v=${video_id}`,
      );
      indexing.add(video_id);
      setTimeout(() => indexing.delete(video_id), 10 * 60 * 1000);

      return res.json({
        content:
          "This video hasn't been indexed yet, so I've started processing it. It takes about 2 to 3 minutes. Please ask again shortly.",
      });
    }

    const result = await agent.invoke(
      { messages: [{ role: "user", content: query }] },
      { configurable: { thread_id: String(thread_id), video_id } },
    );

    const content = result.messages.at(-1)?.content;
    res.json({
      content: typeof content === "string" ? content : JSON.stringify(content),
    });
  } catch (err) {
    console.error("generate failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
});

app.post("/webhook", async (req, res) => {
  const videos = Array.isArray(req.body) ? req.body : [req.body];
  console.log("Webhook received:", videos.length, "video(s)");

  try {
    // One at a time to keep memory low on the free instance
    for (const video of videos) {
      await addYTVideoTOVectorStore(video);
    }
    console.log("Webhook indexing done");
    res.send("OK");
  } catch (err) {
    console.error("Webhook indexing failed:", err);
    res.status(500).send("Indexing failed");
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});