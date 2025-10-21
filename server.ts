// server.ts

import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

// 1. Загрузка переменных окружения
dotenv.config(); 

// 2. Импорт роутов и сервисов
// Теперь импорты ссылаются на .ts файлы (или ожидается, что они будут скомпилированы из .ts),
// поэтому суффикс .js удален.
import tokenRoutes from "./src/token.routes"; 
import * as solanaService from "./src/solana.service"; 

const app = express();
// Порт берется из .env, или используется 3000 по умолчанию
const PORT = process.env.PORT || 3000; 

// === Middlewares ===
// Разрешаем все CORS-запросы для удобства разработки
app.use(cors({ origin: "*" })); 
app.use(express.json());

// === Проверка здоровья сервера ===
app.get("/", (req: Request, res: Response) => {
    res.status(200).json({ 
        status: "OK", 
        message: "Solana Token Backend запущен.",
        port: PORT
    });
});

// === Подключение роутов ===
// Все роуты из token.routes.ts будут доступны по /api/...
app.use("/api", tokenRoutes); 

// === Запуск сервера ===
app.listen(PORT, () => {
    // В консоль будет выведен адрес сервисного кошелька (если он правильно настроен в .env)
    console.log(`🚀 Backend запущен на порту ${PORT}`);
    // Здесь solanaService.ts выполняет свою начальную логику
});
