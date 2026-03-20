import express from "express";
import Device from "../models/Device.js";

const router = express.Router();

// ➕ เพิ่มอุปกรณ์
router.post("/", async(req,res)=>{
try{

const {name,qty,image} = req.body;

const device = new Device({
name,
qty,
image
});

await device.save();

res.json({message:"saved"});

}catch(err){
res.status(500).json(err);
}
});

export default router;