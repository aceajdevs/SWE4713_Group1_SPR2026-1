/* eslint-disable */
import crypto from "crypto";

const algorithm = "aes-128-gcm";

export function encrypt(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    content: encrypted.toString("hex"),
    tag: authTag.toString("hex")
  };
}

export function decrypt(encrypted, key) {
  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    key,
    Buffer.from(encrypted.iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(encrypted.tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted.content, "hex")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

const key = Buffer.from("00112233445566778899aabbccddeeff", "hex");

const encrypted = encrypt("mySecretPassword", key);
const decrypted = decrypt(encrypted, key);


console.log(encrypted);
console.log(decrypted);