// src/pinata-upload.route.ts

import express from "express";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Используем правильные переменные из ENV!
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET = process.env.PINATA_SECRET_API_KEY; // Имя совпадает с Render

router.post("/upload-logo", upload.single("file"), async (req, res) => {
  // Проверяем входные данные от фронта
  console.log("Received fields:", req.body);
  if (!req.file) {
    console.log("No file received from frontend!");
    return res.status(400).json({ error: "Нет файла" });
  }
  console.log("Received file info:", {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });

  // Проверка наличия ключей
  if (!PINATA_API_KEY || !PINATA_SECRET) {
    console.error("Pinata API ключи не заданы! PINATA_API_KEY:", PINATA_API_KEY, "PINATA_SECRET_API_KEY:", PINATA_SECRET);
    return res.status(500).json({ error: "Pinata API ключи не заданы на сервере." });
  }

  try {
    const data = new FormData();
    data.append("file", req.file.buffer, { filename: req.file.originalname });

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      data,
      {
        maxBodyLength: Infinity,
        headers: {
          ...data.getHeaders(),
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET,
        },
      }
    );

    if (!response.data || !response.data.IpfsHash || typeof response.data.IpfsHash !== "string") {
      return res.status(500).json({ error: "Pinata не вернула IpfsHash. Ответ: " + JSON.stringify(response.data) });
    }

    const ipfsHash = response.data.IpfsHash;
    if (!/^Qm[a-zA-Z0-9]{44}$|^bafy[a-zA-Z0-9]+$/.test(ipfsHash)) {
      return res.status(500).json({ error: "Некорректный IpfsHash: " + ipfsHash });
    }

    // Возвращаем ссылку через публичный gateway Pinata
    res.json({ ipfsUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}` });
  } catch (err) {
    console.error("Ошибка при загрузке на Pinata:", err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : String(err) || "Ошибка загрузки на Pinata" 
    });
  }
});

export default router;

