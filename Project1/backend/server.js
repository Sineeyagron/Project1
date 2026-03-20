import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import deviceRoutes from "./routes/device.js";
import borrowRoutes from "./routes/borrow.js";
import roomRoutes from "./routes/room.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/device",deviceRoutes);
app.use("/api/borrow",borrowRoutes);
app.use("/api/room",roomRoutes);

mongoose.connect(process.env.MONGO_URI)
.then(()=> console.log("MongoDB Connected"))
.catch(err => console.log(err));

app.use("/api/auth", authRoutes);

app.listen(5000, () => {
  console.log("Server running on port 5000");


});