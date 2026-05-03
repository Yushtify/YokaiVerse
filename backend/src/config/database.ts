import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/yokaiverse";

    await mongoose.connect(mongoURI);

    console.log("✅ MongoDB bağlantı başarılı");
  } catch (error) {
    console.error("❌ MongoDB bağlantı hatası:", error);
    process.exit(1);
  }
};

export default connectDB;
