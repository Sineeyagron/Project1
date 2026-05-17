import express from "express";
import Room from "../models/Room.js";

const router = express.Router();

// ➕ เพิ่มห้อง
router.post("/", async(req,res)=>{
  try{
    const {name} = req.body;

    const room = new Room({name});
    await room.save();

    res.json(room);

  }catch(err){
    res.status(500).json(err);
  }
});

// 📥 ดึงห้องทั้งหมด
router.get("/", async(req,res)=>{
  const rooms = await Room.find().sort({createdAt:-1});
  res.json(rooms);
});

export default router;