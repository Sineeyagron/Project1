import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  name:String
},{timestamps:true});

export default mongoose.model("Room",roomSchema);