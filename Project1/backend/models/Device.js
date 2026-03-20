import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema({
name:String,
qty:Number,
image:String
},{
timestamps:true
});

export default mongoose.model("Device",deviceSchema);