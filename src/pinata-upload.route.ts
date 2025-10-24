// src/pinata-upload.route.ts

import express from "express";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET = process.env.PINATA_SECRET;

router.post("/api/upload-logo", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Нет файла" });

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

    // Проверка корректности ответа Pinata
    if (!response.data || !response.data.IpfsHash || typeof response.data.IpfsHash !== "string") {
      return res.status(500).json({ error: "Pinata не вернула IpfsHash. Ответ: " + JSON.stringify(response.data) });
    }

    const ipfsHash = response.data.IpfsHash;
    // Дополнительная проверка на шаблон IPFS-хэша (Qm.../ba.../bafy...)
    if (!/^Qm[a-zA-Z0-9]{44}$|^bafy[a-zA-Z0-9]+$/.test(ipfsHash)) {
      return res.status(500).json({ error: "Некорректный IpfsHash: " + ipfsHash });
    }

    res.json({ ipfsUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}` });
  } catch (err) {
    res.status(500).json({ 
      error: err instanceof Error ? err.message : String(err) || "Ошибка загрузки на Pinata" 
    });
  }
});

export default router;
