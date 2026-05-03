import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:4321",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database bağlantısı
connectDB();

// Health Check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "Backend çalışıyor! ✅",
    timestamp: new Date().toISOString(),
  });
});

// License endpoint (AGPLv3)
app.get("/api/license", (req: Request, res: Response) => {
  res.json({
    license: "AGPL-3.0-or-later",
    source: "https://github.com/yushtify/yokaiverse",
    message: "YokaiVerse is free software under AGPL-3.0",
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Endpoint bulunamadı",
  });
});

// Error handler
app.use((err: any, req: Request, res: Response) => {
  console.error("❌ Error:", err);
  res.status(500).json({
    success: false,
    message: "Sunucu hatası",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend çalışıyor: http://localhost:${PORT}`);
});
