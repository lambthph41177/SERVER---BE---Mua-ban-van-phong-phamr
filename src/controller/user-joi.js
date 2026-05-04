import { User } from "../model/User";
import { Order } from "../model/order";
import hash from "bcryptjs";
import { reqSchema, loginSchema, addUserSchema } from "../Schema/auth"; // Đã sửa chính tả Schema
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";

const ACCESS_TOKEN_SECRET = "76ca127f19145007f2723d48ce8cbf296fb7427ac4ffe557daa38952697dabb272c181f843bccfd89065158f44470be37eca0f6e6ba9da90a107f2dc0b90164a";
const REFRESH_TOKEN_SECRET = "040fecc7c403886ec097dc0e001ab80598ba0bdac391e72b8aeef0797f6dee72dedd5c97a2016bcbd3b641dfcc3706149313b7ca8e17c8511fafcc33763d2590";

/**
 * Đăng ký tài khoản (Công khai)
 */
export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate dữ liệu
    const { error } = reqSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const list = error.details.map((issue) => ({ message: issue.message }));
      return res.status(400).json(list);
    }

    // Kiểm tra trùng lặp
    const [emailUser, usernameUser] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ username }),
    ]);

    if (emailUser) return res.status(400).json({ message: "Email đã tồn tại" });
    if (usernameUser) return res.status(400).json({ message: "Tên đăng nhập đã tồn tại" });

    const hashedPassword = await hash.hash(password, 10);

    const newUser = await User.create({
      ...req.body,
      password: hashedPassword,
      role: "user", // Luôn là user khi đăng ký tự do
      active: req.body.active ?? false,
    });

    return res.status(201).json({
      message: "Tạo tài khoản thành công",
      user: newUser,
    });
  } catch (error) {
    return res.status(500).json({ message: "Đăng ký thất bại", error: error.message });
  }
};

/**
 * Đăng nhập
 */
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { error } = loginSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ errors: error.details.map(i => ({ message: i.message })) });
    }

    const user = await User.findOne({ email });
    if (!user || !(await hash.compare(password, user.password))) {
      return res.status(400).json({ message: "Thông tin đăng nhập không hợp lệ" });
    }

    const safeUser = user.toObject();
    delete safeUser.password;

    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      ACCESS_TOKEN_SECRET,
      { expiresIn: "1d" }
    );

    const refreshToken = jwt.sign({ id: user._id }, REFRESH_TOKEN_SECRET, { expiresIn: "7d" });

    // Cấu hình Cookie
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    };

    res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 86400000 });
    res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 604800000 });

    return res.status(200).json({
      user: safeUser,
      token: accessToken,
      mustChangePassword: user.mustChangePassword === true,
      message: "Đăng nhập thành công",
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

/**
 * Quên mật khẩu - Gửi Email
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "Email không tồn tại" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 phút

    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "samtrung0809@gmail.com",
        pass: "fxkv ohaj zqgy tnim", // Nên dùng biến môi trường
      },
    });

    await transporter.sendMail({
      to: user.email,
      subject: "Đặt lại mật khẩu",
      html: `
        <h3>Yêu cầu đặt lại mật khẩu</h3>
        <p>Mã xác nhận của bạn là: <b>${resetToken}</b></p>
        <p>Mã này sẽ hết hạn sau 15 phút.</p>
      `,
    });

    res.json({ message: "Đã gửi email hướng dẫn đặt lại mật khẩu" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Đặt lại mật khẩu mới
 */
export const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Mã xác nhận không hợp lệ hoặc đã hết hạn" });
    }

    user.password = await hash.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Lấy danh sách người dùng (Phân trang + Search)
 */
export const GetUser = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search?.trim() || "";
    const includeOrderCount = req.query.includeOrderCount === "true";
    const skip = (page - 1) * limit;

    const filter = {
      role: { $nin: ["manage"] },
      ...(search && { username: { $regex: search, $options: "i" } }),
    };

    const [total, data] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select("-password").skip(skip).limit(limit).sort({ createdAt: -1 }),
    ]);

    let results = data.map(d => d.toObject());

    if (includeOrderCount && data.length > 0) {
      const orderCounts = await Order.aggregate([
        { $match: { userId: { $in: data.map(u => u._id) } } },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
      ]);
      const countMap = new Map(orderCounts.map(i => [String(i._id), i.count]));
      results = results.map(u => ({ ...u, orderCount: countMap.get(String(u._id)) || 0 }));
    }

    return res.status(200).json({
      success: true,
      data: results,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// ... Các hàm Logout, UpdateUser, UpdatePassword giữ nguyên logic logic và format tương tự