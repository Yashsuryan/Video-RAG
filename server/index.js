import express from "express";
import cors from "cors";
import { agent } from "./agent.js";

const port = process.env.PORT || 3000;

const app = express();

app.use(express.json());
app.use(cors({
    origin: ["https://video-rag-cn3e.onrender.com/", "http://localhost:5173"],
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
