import { Comment } from "../model/comment"; // Điều chỉnh đường dẫn file model của bạn

/**
 * Thêm bình luận mới
 */
export const addComment = async (req, res) => {
  try {
    const { productId, content, rating } = req.body;
    const userId = req.user.id; // Lấy từ middleware verifyToken

    if (!content?.trim()) {
      return res.status(400).json({ message: "Nội dung bình luận không được để trống" });
    }

    const newComment = await Comment.create({
      userId,
      productId,
      content,
      rating,
    });

    // Populate thông tin user để trả về frontend hiển thị ngay
    const populatedComment = await newComment.populate("userId", "username avatar");

    return res.status(201).json(populatedComment);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Lấy danh sách bình luận của một sản phẩm
 */
export const getCommentsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    
    const comments = await Comment.find({ productId })
      .populate("userId", "username avatar") // Hiển thị tên và ảnh đại diện người dùng
      .sort({ createdAt: -1 }); // Mới nhất lên đầu

    return res.status(200).json(comments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
/**
 * Xóa bình luận
 * Lưu ý: Chỉ Admin hoặc chính chủ mới được xóa
 */
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const comment = await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({ message: "Không tìm thấy bình luận" });
    }

    
    // Kiểm tra quyền: Nếu không phải Admin/Manage VÀ không phải chủ nhân của comment
    if (
      user.role !== "admin" && 
      user.role !== "manage" && 
      String(comment.userId) !== String(user.id)
    ) {
      return res.status(403).json({ message: "Bạn không có quyền xóa bình luận này" });
    }

    await Comment.findByIdAndDelete(id);
    
    return res.status(200).json({ message: "Xóa bình luận thành công" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};