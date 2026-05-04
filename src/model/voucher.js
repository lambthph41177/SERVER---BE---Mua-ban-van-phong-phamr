import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true, // Thông thường mã voucher nên là duy nhất
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    // --- Cấu hình giảm giá ---
    discount: {
      type: Number, // Phần trăm giảm giá
      required: true,
      min: 0,
    },
    maxPriceDis: {
      type: Number, // Số tiền giảm tối đa
      required: true,
      min: 0,
    },
    // --- Giới hạn & Trạng thái ---
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // --- Thời gian hiệu lực ---
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true } // Tự động thêm createdAt và updatedAt
);

export const Voucher = mongoose.models.vouchers || mongoose.model("vouchers", voucherSchema);