import mongoose from "mongoose";

const borrowSchema = new mongoose.Schema({
studentId:String,
deviceId:String,
deviceName:String,
borrowDate:String,
returnDate:String,
status:{
type:String,
default:"borrowed"
}
},{timestamps:true});

export default mongoose.model("Borrow",borrowSchema);