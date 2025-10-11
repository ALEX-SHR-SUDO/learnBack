// server.js

import express from "express";
import cors from "cors";
import tokenRoutes from "./src/token.routes.js"; // Обязательно .js
// Импортируем solanaService, чтобы инициализировать кошелек при запуске
import * as solanaService from "./src/solana.service.js"; 

const app = express();
const PORT = process.env.PORT || 3000; 

// === Middlewares ===
app.use(cors({ origin: "*" }));
app.use(express.json());

// === Подключение роутов ===
// Все роуты из token.routes.js будут доступны по /api/...
app.use("/api", tokenRoutes); 

// === Запуск сервера ===
app.listen(PORT, () => {
    // Адрес кошелька уже должен быть выведен из solana.service.js
    console.log(`🚀 Backend запущен на порту ${PORT}`);
});