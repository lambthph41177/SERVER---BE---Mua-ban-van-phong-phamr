import { Order } from "../model/order";
import { Voucher } from "../model/voucher";

/**
 * Tạo mới Voucher
 */
export const CreateVoucher = async (req, res) => {
  try {
    const data = await new Voucher(req.body).save();
    return res.status(201).json({
      message: "Thêm voucher thành công",
      data,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Lấy tất cả danh sách Voucher
 */
export const getAllVoucher = async (req, res) => {
  try {
    const data = await Voucher.find().sort({ createdAt: -1 }); // Mới nhất lên đầu
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Cập nhật Voucher
 */
export const UpdateVoucher = async (req, res) => {
  try {
    const data = await Voucher.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    
    if (!data) {
      return res.status(404).json({ message: "Không tìm thấy voucher" });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Xóa Voucher (Có kiểm tra ràng buộc đơn hàng)
 */
export const DeleteVoucher = async (req, res) => {
  try {
    const voucherId = req.params.id;

    // Kiểm tra voucher đã được dùng trong đơn hàng nào chưa
    const orderExist = await Order.findOne({ voucherId });

    if (orderExist) {
      return res.status(400).json({
        message: "Voucher đã được sử dụng trong đơn hàng, không thể xóa",
      });
    }

    const deletedVoucher = await Voucher.findByIdAndDelete(voucherId);
    
    if (!deletedVoucher) {
      return res.status(404).json({ message: "Voucher không tồn tại" });
    }

    return res.status(200).json({
      message: "Xóa voucher thành công",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Chi tiết Voucher
 */
export const DetailVoucher = async (req, res) => {
  try {
    const data = await Voucher.findById(req.params.id);
    
    if (!data) {
      return res.status(404).json({ message: "Không tìm thấy voucher" });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};