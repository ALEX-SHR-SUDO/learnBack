const { Keypair } = require("@solana/web3.js");
const fs = require("fs");

// Генерируем кошелёк
const wallet = Keypair.generate();

// Сохраняем приватный ключ в файл (не показывай никому!)
fs.writeFileSync("service_wallet.json", JSON.stringify(Array.from(wallet.secretKey)));

console.log("Сервисный кошелёк создан!");
console.log("PublicKey:", wallet.publicKey.toBase58());
