// server.js (В корне проекта)

const express = require("express");
const cors = require("cors");
const tokenRoutes = require("./src/token.routes"); // Подключаем роуты
const solanaService = require("./src/solana.service"); // Запускаем инициализацию кошелька

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