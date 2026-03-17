import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import nodemailer from "nodemailer";

const router = express.Router();

let transporter;

// สร้าง transporter สำหรับทดสอบ
async function getTransporter() {
  if (!transporter) {
    const testAccount = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    console.log("Ethereal Email:", testAccount.user);
  }

  return transporter;
}

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const otp = Math.floor(100000 + Math.random() * 900000);

    const user = new User({
      username,
      email,
      password: hash,
      otp
    });

    await user.save();

    const transporter = await getTransporter();

    const info = await transporter.sendMail({
      from: '"OTP App" <no-reply@test.com>',
      to: email,
      subject: "Verify OTP",
      text: `Your OTP is ${otp}`
    });

    console.log("Preview URL:", nodemailer.getTestMessageUrl(info));

    res.json({ message: "OTP sent" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Register error" });
  }
});

export default router;