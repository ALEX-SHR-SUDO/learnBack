// server.ts

import express from "express";
import cors from "cors";
import tokenRoutes from "./src/token.routes.js"; // Обязательно .js
import pinataUploadRoute from "./src/pinata-upload.route.js";
import metadataGeneratorRoute from "./src/metadata-generator.route.js";
import metadataUploadRoute from "./src/metadata-upload.route.js"; // New: Separated upload routes
// Импортируем solanaService, чтобы инициализировать кошелек при запуске
// ✅ ИСПРАВЛЕНО: Обновлен путь импорта на .ts файл (с расширением .js для рантайма)
import * as solanaService from "./src/solana.service.js";

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3000', 10);

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
      walletBalance: "/api/wallet-balance",
      uploadLogoOnly: "POST /api/upload-logo-only (NEW - Step 1: Upload logo to IPFS)",
      generateMetadataOnly: "POST /api/generate-metadata-only (NEW - Step 2: Generate metadata JSON with pre-uploaded logo)",
      generateMetadata: "POST /api/generate-metadata (Combined - Uploads logo and generates metadata in one step)",
      createToken: "POST /api/create-token (Service wallet pays, optional recipientWallet parameter)",
      createUnsignedToken: "POST /api/create-unsigned-token (NEW - User wallet - frontend signs)",
      submitSignedTransaction: "POST /api/submit-signed-transaction (NEW - Submit user-signed transaction)",
      upload: "POST /api/upload-logo (Legacy)",
      revokeFreezeAuthority: "POST /api/revoke-freeze-authority",
      revokeMintAuthority: "POST /api/revoke-mint-authority"
    }
  });
});

// === Подключение роутов ===
// Все роуты из token.routes.js будут доступны по /api/...
app.use("/api", tokenRoutes);
app.use("/api", pinataUploadRoute);
app.use("/api", metadataGeneratorRoute);
app.use("/api", metadataUploadRoute); // New: Separated upload routes

// === Запуск сервера ===
// Start server for traditional hosting (Render, local dev, etc.)
// Skip only if explicitly running in serverless mode (Vercel, AWS Lambda)
const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
if (!isServerless) {
  app.listen(PORT, '0.0.0.0', () => {
    // Адрес кошелька уже должен быть выведен из solana.service.ts
    console.log(`🚀 Backend запущен на порту ${PORT}`);
  });
}

// Export for Vercel serverless
export default app;
