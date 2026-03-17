import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  otp: String,
  verified: {
    type: Boolean,
    default: false
  }
});

export default mongoose.model("User", UserSchema);