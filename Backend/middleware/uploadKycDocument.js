import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import AppError from "../utils/AppError.js";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KYC_UPLOAD_DIR = path.join(__dirname, "../uploads/kyc");

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, KYC_UPLOAD_DIR);
  },
  filename: (_req, file, callback) => {
    const uniqueSuffix = crypto.randomUUID();
    const extension = path.extname(file.originalname);

    callback(null, `${uniqueSuffix}${extension}`);
  },
});

const fileFilter = (_req, file, callback) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(
      new AppError("Only JPEG, PNG, and PDF files are allowed", 400)
    );
  }
 
  callback(null, true);
};

const uploadKycDocument = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).single("document");

export default uploadKycDocument;