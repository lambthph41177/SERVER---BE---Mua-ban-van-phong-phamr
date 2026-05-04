import { Order } from "../model/order";
import { Product } from "../model/product";

// --- HELPERS (Các hàm hỗ trợ) ---

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (Array.isArray(value) || typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseBooleanField = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
};

const buildUploadedImageUrls = (req) =>
  (req.files || []).map(
    (file) => `${req.protocol}://${req.get("host")}/uploads/products/${file.filename}`
  );

/**
 * Hàm xây dựng dữ liệu sản phẩm dùng chung cho Add và Update
 */
const buildProductPayload = ({ req, existingImages = [] }) => {
  const variants = parseJsonField(req.body.variants, []).map((item) => ({
    color: item?.color,
    price: Number(item?.price || 0),
    priceWholesale: Number(item?.priceWholesale || 0),
    quantity: Number(item?.quantity || 0),
    status: item?.status !== undefined ? parseBooleanField(item.status, true) : true,
  }));

  const uploadedImages = buildUploadedImageUrls(req);
  const albumImage = [...existingImages, ...uploadedImages].filter(Boolean); // Đã sửa tên albumImage

  const totalQuantity = variants.length
    ? variants.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    : Number(req.body.quantity || 0);

  const productPrice = variants.length ? Number(variants[0]?.price || 0) : Number(req.body.price || 0);
  const productPriceWholesale = variants.length
    ? Number(variants[0]?.priceWholesale || 0)
    : Number(req.body.priceWholesale || 0);

  return {
    name: req.body.name,
    category: req.body.category, // Đã sửa caterori thành category
    brand: req.body.brand || "",
    origin: req.body.origin || "",
    price: productPrice,
    priceWholesale: productPriceWholesale,
    variants,
    imageUrl: albumImage[0] || "",
    albumImage,
    discount: Number(req.body.discount || 0),
    description: req.body.description,
    status: parseBooleanField(req.body.status, true),
    quantity: totalQuantity,
  };
};

// --- CONTROLLERS ---

export const GetAllProduct = async (req, res) => {
  try {
    const data = await Product.find()
      .populate("category", "name") // Đồng bộ category
      .populate("createdBy", "username")
      .sort({ createdAt: -1 });

    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const Pagination = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const [totalProduct, data] = await Promise.all([
      Product.countDocuments(),
      Product.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
    ]);

    return res.status(200).json({
      currentPage: page,
      totalPages: Math.ceil(totalProduct / limit),
      totalProduct,
      limit,
      data,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const GetProductDetails = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category", "name");

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    return res.status(200).json({
      message: "Tìm thấy sản phẩm",
      data: product,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const GetProductsCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const products = await Product.find({ category });

    if (products.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm nào trong danh mục này." });
    }

    return res.status(200).json(products);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server." });
  }
};

export const AddProduct = async (req, res) => {
  try {
    const data = await Product.create({
      ...buildProductPayload({ req }),
      createdBy: req.user.id,
    });

    return res.status(201).json({
      message: "Thêm sản phẩm thành công",
      data,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const UpdateProduct = async (req, res) => {
  try {
    const currentProduct = await Product.findById(req.params.id);

    if (!currentProduct) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    const existingImages = parseJsonField(req.body.existingImages, currentProduct.albumImage || []);

    const data = await Product.findByIdAndUpdate(
      req.params.id,
      {
        ...buildProductPayload({ req, existingImages }),
        updatedBy: req.user.id,
      },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      message: "Cập nhật thành công",
      data,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const DeleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // Chặn xóa nếu sản phẩm đã có trong đơn hàng
    const ordersWithProduct = await Order.countDocuments({
      "products.productId": productId,
    });

    if (ordersWithProduct > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa vì sản phẩm đang tồn tại trong ${ordersWithProduct} đơn hàng`,
      });
    }

    const deletedProduct = await Product.findByIdAndDelete(productId);

    if (!deletedProduct) {
      return res.status(404).json({ success: false, message: "Sản phẩm không tồn tại" });
    }

    return res.status(200).json({
      success: true,
      message: "Xóa sản phẩm thành công",
      
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};