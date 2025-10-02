const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/button-click', (req, res) => {
  console.log('Кнопка была нажата!');
  res.json({ message: 'Сервер получил нажатие кнопки!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
