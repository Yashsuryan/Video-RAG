import express from "express";
import cors from "cors";
import { agent } from "./agent.js";
import { addYTVideoTOVectorStore } from "./embeddings.js";

const port = process.env.PORT || 3000;

const app = express();

app.use(express.json({ limit: '200mb' }));
app.use(cors({
    origin: ["https://client-omega-hazel-63.vercel.app", "http://localhost:5173"],
}));

app.get("/", (req, res) => {
  res.send("hello world");
});

app.post("/generate", async (req, res) => {
  const { query, video_id, thread_id } = req.body;
  console.log(query, video_id, thread_id);

  const result1 = await agent.invoke(
    {
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
    },
    { configurable: { thread_id, video_id } },
  );

  res.json(result1.messages.at(-1)?.content);
});

app.post('/webhook', async (req, res) => {

    await Promise.all(
        req.body.map(async (video) => addYTVideoTOVectorStore(video))
    );

    res.send('OK');
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
