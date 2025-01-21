const mongoose = require("mongoose");//ok

const UserSchema = new mongoose.Schema({
   username: { type: String, required: true },
   email: { type: String, required: true, unique: true },
   password: { type: String, required: true },
   stories: [
      {
         title: { type: String, required: true },
         content: { type: String, required: true }
      }
   ],
});

module.exports = mongoose.model("User", UserSchema);
