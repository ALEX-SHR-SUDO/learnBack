const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post("/chat", (req, res) => {
  const { name, symbol, decimals, supply, description } = req.body;

  const reply = {
    name: name ? `Имя токена принято: ${name}` : "Нет имени",
    symbol: symbol ? `Символ принят: ${symbol}` : "Нет символа",
    decimals: decimals ? `Десятичные: ${decimals}` : "Не указано",
    supply: supply ? `Эмиссия: ${supply}` : "Не указано",
    description: description ? `Описание принято: ${description}` : "Нет описания"
  };

  res.json(reply);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
