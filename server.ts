// server.ts

import express from "express";
import cors from "cors";
import tokenRoutes from "./src/token.routes.js"; // Обязательно .js
import pinataUploadRoute from "./src/pinata-upload.route.js";
// Импортируем solanaService, чтобы инициализировать кошелек при запуске
// ✅ ИСПРАВЛЕНО: Обновлен путь импорта на .ts файл (с расширением .js для рантайма)
import * as solanaService from "./src/solana.service.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  console.log("Запрос:", req.method, req.url);
  next();
});

// === Middlewares ===
app.use(cors({ origin: "*" }));
app.use(express.json());

// === Root health check endpoint ===
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Solana Token Backend API",
    version: "1.0.0",
    endpoints: {
      health: "/api/ping",
      balance: "/api/balance",
      createToken: "POST /api/create-token",
      upload: "POST /api/upload-logo"
    }
  });
});

// === Подключение роутов ===
// Все роуты из token.routes.js будут доступны по /api/...
app.use("/api", tokenRoutes);
app.use("/api", pinataUploadRoute);

// === Запуск сервера ===
// Start server for traditional hosting (Render, local dev, etc.)
// Skip only if explicitly running in serverless mode (Vercel, AWS Lambda)
const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
if (!isServerless) {
  app.listen(PORT, () => {
    // Адрес кошелька уже должен быть выведен из solana.service.ts
    console.log(`🚀 Backend запущен на порту ${PORT}`);
  });
}

// Export for Vercel serverless
export default app;
