import crypto from "crypto";

const hashToken = (rawToken) => {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};

export default hashToken;
