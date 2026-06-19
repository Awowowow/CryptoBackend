import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((err, success) => {
  if (err) {
    console.error("❌ Email config error:", err);
  } else {
    console.log("✅ Email server ready");
  }
});

const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"CryptoEx" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your CryptoEx account",
    html: `
      <p>Hi,</p>
      <p>Welcome to CryptoEx. Please verify your email to activate your account.</p>
      <p><a href="${verifyUrl}">Verify email address</a></p>
      <p>If you did not create this account, you can ignore this email.</p>
    `,
  });
};

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"Crypto App" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your password",
    html: `
      <h2>Password Reset</h2>
      <p>Click below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link expires in 15 minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  });
};

export { sendVerificationEmail, sendPasswordResetEmail };
