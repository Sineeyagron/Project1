import express from "express";
import Borrow from "../models/Borrow.js";

const router = express.Router();

// ➕ ยืม
router.post("/", async(req,res)=>{
try{

const {studentId,deviceId,deviceName} = req.body;

const today = new Date();
const returnDate = new Date();
returnDate.setDate(today.getDate()+3);

const borrow = new Borrow({
studentId,
deviceId,
deviceName,
borrowDate: today.toLocaleDateString(),
returnDate: returnDate.toLocaleDateString()
});

await borrow.save();

res.json({message:"borrow success"});

}catch(err){
res.status(500).json(err);
}
});

// 📥 ดึงรายการ
router.get("/", async(req,res)=>{
const data = await Borrow.find().sort({createdAt:-1});
res.json(data);
});

export default router;