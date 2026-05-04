import jwt from "jsonwebtoken";

// Nên lưu trong file .env: process.env.ACCESS_TOKEN_SECRET
const ACCESS_TOKEN_SECRET =
  "76ca127f19145007f2723d48ce8cbf296fb7427ac4ffe557daa38952697dabb272c181f843bccfd89065158f44470be37eca0f6e6ba9da90a107f2dc0b90164a";

// Cấu hình Role
const ROLES = {
  MANAGE: "manage",
  ADMIN: "admin",
  USER: "user",
};

/**
 * Lấy token từ Cookie hoặc Header
 */
const extractToken = (req) => {
  return (
    req.cookies?.accessToken ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null)
  );
};

/**
 * Hàm xác thực chung
 */
const verifyToken = (req, res, next, allowedRoles = []) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token missing",
      });
    }

    jwt.verify(token, ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        const status = err.name === "TokenExpiredError" ? 401 : 400;
        const message = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
        return res.status(status).json({ success: false, message });
      }

      // Kiểm tra quyền (nếu có yêu cầu allowedRoles)
      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Requires [${allowedRoles.join(", ")}]`,
        });
      }

      req.user = decoded;
      next();
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- MIDDLEWARES XUẤT RA ---

// Cho phép Admin và Manage
export const checkout = (req, res, next) => {
  verifyToken(req, res, next, [ROLES.ADMIN, ROLES.MANAGE]);
};

// Chỉ dành riêng cho Manage
export const checkManage = (req, res, next) => {
  verifyToken(req, res, next, [ROLES.MANAGE]);
};

// Mọi User đã đăng nhập
export const checkUser = (req, res, next) => {
  verifyToken(req, res, next, [ROLES.USER, ROLES.ADMIN, ROLES.MANAGE]);
};

/**
 * Kiểm tra quyền sở hữu (Owner)
 * Admin/Manage được qua, User thường chỉ được xem data của chính mình
 */
export const checkOwner = (req, res, next) => {
  verifyToken(req, res, () => {
    const { id, role } = req.user;
    const paramUserId = req.params.userid || req.params.id;

    // Bypass cho Admin/Manage
    if (role === ROLES.ADMIN || role === ROLES.MANAGE) {
      return next();
    }

    // Kiểm tra trùng ID
    if (paramUserId && String(id) !== String(paramUserId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Not your data",
      });
    }
    next();
  });
};

/**
 * Chỉ cho phép thao tác với chính mình (Kể cả Admin cũng phải đúng ID)
 */
export const checkSelf = (req, res, next) => {
  verifyToken(req, res, () => {
    const { id } = req.user;
    const paramUserId = req.params.userid || req.params.id;

    if (!paramUserId || String(id) !== String(paramUserId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Self-only action",
      });
    }
    next();
  });
};