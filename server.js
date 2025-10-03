const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Чат маршрут
app.post("/chat", (req, res) => {
  const userMessage = req.body.message || "";
  console.log("Сообщение от клиента:", userMessage);

  // Простейший ответ сервера (можно усложнить)
  res.json({ reply: `Сервер получил: "${userMessage}"` });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
