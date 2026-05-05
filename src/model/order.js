import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    madh: {
      type: Number,
      required: true,
      unique: true, // Mã đơn hàng nên là duy nhất
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: false,
      default: "",
      lowercase: true,
    },
    customerType: {
      type: String,
      enum: ["retail", "wholesale"],
      default: "retail",
    },
    orderSource: {
      type: String,
      enum: ["customer_self_service", "manual_entry"],
      default: "customer_self_service",
    },

    // --- Chi tiết sản phẩm trong đơn hàng ---
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "products",
          required: true,
        },
        name: { type: String, required: true },
        color: { type: String, required: true },
        quantity: { type: Number, default: 1, min: 1 },
        priceBeforeDis: { type: Number, required: true },
        priceAfterDis: { type: Number, required: true },
      },
    ],


    // --- Thanh toán và Tổng tiền ---
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    payment: {
      type: String,
      enum: ["COD", "VNPAY", "MOMO", "GG PAY", "ZALO PAY"],
      default: "COD",
    },
    isPaymentSuccess: { // Đã sửa lỗi chính tả Success
      type: Boolean,
      default: false,
    },

  
    // --- Trạng thái và Vận hành ---
    status: {
      type: String,
      enum: ["Xác nhận", "Đang giao hàng", "Thành Công", "Hủy"],
      default: "Xác nhận",
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    cancelReason: {
      type: String,
      default: "",
    },
    note: {
      type: String,
      default: "",
    },

    // --- Liên kết ---
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "vouchers",
      default: null,
      set: (v) => (v === "" ? null : v),
    },

  
    // --- Thông tin hóa đơn (Invoice) ---
    invoiceRequested: {
      type: Boolean,
      default: false,
    },
    invoiceInfo: {
      companyName: { type: String, default: "" },
      taxCode: { type: String, default: "" },
      invoiceEmail: { type: String, default: "" },
      invoiceAddress: { type: String, default: "" },
      note: { type: String, default: "" },
    },
  },
  {
    timestamps: true, // Tự động tạo createdAt và updatedAt
  }
);

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);