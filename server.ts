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

// === Middlewares ===
app.use(cors({ origin: "*" }));
app.use(express.json());



// === Подключение роутов ===
// Все роуты из token.routes.js будут доступны по /api/...
app.use("/api", tokenRoutes);
app.use("/api", pinataUploadRoute);

// === Запуск сервера ===
app.listen(PORT, () => {
// Адрес кошелька уже должен быть выведен из solana.service.ts

console.log(`🚀 Backend запущен на порту ${PORT}`);
});
