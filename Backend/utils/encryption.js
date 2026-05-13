import crypto from "crypto";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const getEncryptionKey = () =>{
  const rawKey = process.env.TWO_FA_ENCRYPTED_KEY;
    if(!rawKey){
        throw new Error("TWO_FA_ENCRYPTION_KEY is not configured");
    }
    const key = Buffer.from(rawKey, "hex");

    if (key.length !== 32) {
        throw new Error("TWO_FA_ENCRYPTION_KEY must be a 32-byte hex string");
      }
    return key
}

export const encryptText = (plainText) =>{
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

    const encrypted = Buffer.concat([
        cipher.update(plainText, "utf8"),
        cipher.final(),
      ]);

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export const decryptText = (encryptedText) => {
    const [ivHex, authTagHex, encryptedHex] = encryptedText.split(":");

    if(!ivHex || !authTagHex || !encryptedHex){
        throw new Error("Invalid encrypted text format");
    }
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        getEncryptionKey(),
        Buffer.from(ivHex, "hex")
      );
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, "hex")),
        decipher.final(),
      ]);
    
    return decrypted.toString("utf8");
}