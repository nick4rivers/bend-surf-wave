import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import surfDataHandler from "./api/surf-data";

const app = express();
const PORT = 3000;

app.use(express.json());

// API routes - powered by the Vercel-compatible serverless function handler
app.all("/api/surf-data", (req, res) => {
  return surfDataHandler(req, res);
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start Server & Vite
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Bend Surf Wave server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
