import mongoose from "mongoose";
import { Order } from "../model/order";
import { Product } from "../model/product";
import { Voucher } from "../model/voucher";

/**
 * Các hàm tiện ích (Helpers)
 */
const normalizeOrdersPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  return payload ? [payload] : [];
};

const getNextOrderCode = async (session) => {
  const lastOrder = await Order.findOne()
    .sort({ madh: -1 })
    .select("madh")
    .session(session);

  return Number(lastOrder?.madh || 1000) + 1;
};

const calculateVoucherDiscount = (voucher, subtotal) => {
  if (!voucher || subtotal <= 0) return 0;

  const now = new Date();
  const isStarted = !voucher.startDate || new Date(voucher.startDate) <= now;
  const isNotExpired = !voucher.endDate || new Date(voucher.endDate) >= now;

  if (!voucher.isActive || voucher.quantity <= 0 || !isStarted || !isNotExpired) {
    throw new Error("Voucher không còn hiệu lực");
  }

  const rawDiscount = Math.round((subtotal * Number(voucher.discount || 0)) / 100);
  const maxDiscount = Number(voucher.maxPriceDis || rawDiscount);

  return Math.min(rawDiscount, maxDiscount);
};

/**
 * Logic xây dựng Document đơn hàng & Xử lý tồn kho
 */
const buildOrderDocument = async (orderInput, session, nextOrderCode, actor) => {
  const normalizedInput = {
    ...orderInput,
    voucherId: orderInput?.voucherId || null,
    invoiceInfo: orderInput?.invoiceInfo || {},
  };

  // 1. Validate dữ liệu cơ bản
  if (!normalizedInput.customerName?.trim()) throw new Error("Tên khách hàng trống");
  if (!normalizedInput.phone?.trim()) throw new Error("Số điện thoại trống");
  if (!normalizedInput.address?.trim()) throw new Error("Địa chỉ trống");
  if (!Array.isArray(normalizedInput.products) || normalizedInput.products.length === 0) {
    throw new Error("Danh sách sản phẩm không hợp lệ");
  }

  // 2. Kiểm tra Voucher
  const voucher = normalizedInput.voucherId
    ? await Voucher.findById(normalizedInput.voucherId).session(session)
    : null;

  if (normalizedInput.voucherId && !voucher) throw new Error("Không tìm thấy voucher");

  // 3. Xử lý từng sản phẩm
  let subtotal = 0;
  const products = [];

  for (const item of normalizedInput.products) {
    const product = await Product.findById(item.productId).session(session);
    if (!product || product.status !== true) throw new Error("Không tìm thấy sản phẩm");

    const variant = product.variants.find(
      (v) => v.color === item.color && v.status === true
    );

    if (!variant) {
      throw new Error(`Không tìm thấy biến thể ${product.name} - ${item.color}`);
    }

    const quantity = Number(item.quantity || 0);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Số lượng ${product.name} không hợp lệ`);
    }

    if (variant.quantity < quantity) {
      throw new Error(`Sản phẩm ${product.name} - màu ${item.color} không đủ số lượng`);
    }

    // Tính giá (Sỉ/Lẻ)
    const isWholesale = normalizedInput.customerType === "wholesale";
    const wholesalePrice = Number(variant?.priceWholesale ?? product?.priceWholesale ?? 0);
    const retailPrice = Number(variant?.price ?? product?.price ?? 0);

    if (isWholesale && wholesalePrice <= 0) {
      throw new Error(`Sản phẩm ${product.name} chưa có giá sỉ`);
    }

    const priceBeforeDis = isWholesale ? wholesalePrice : retailPrice;
    const productDiscount = Math.max(0, Number(product.discount || 0));
    const priceAfterDis = Math.round(priceBeforeDis * (1 - productDiscount / 100));

    // Cập nhật kho (Trừ số lượng biến thể)
    await Product.updateOne(
      { _id: item.productId, "variants._id": variant._id },
      { $inc: { "variants.$.quantity": -quantity } },
      { session }
    );

    
    // Tính lại tổng kho của Product
    const refreshedProduct = await Product.findById(item.productId).session(session);
    if (refreshedProduct) {
      const totalQty = refreshedProduct.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
      await Product.updateOne({ _id: item.productId }, { quantity: totalQty }, { session });
    }

    subtotal += priceAfterDis * quantity;
    products.push({
      productId: item.productId,
      quantity,
      priceBeforeDis,
      priceAfterDis,
      name: product.name,
      color: variant.color,
    });
  }

  // 4. Tính toán tổng tiền & Hóa đơn
  const voucherDiscount = calculateVoucherDiscount(voucher, subtotal);
  const totalPrice = Math.max(0, subtotal - voucherDiscount);
  const invoiceRequested = Boolean(normalizedInput.invoiceRequested);

  if (invoiceRequested) {
    const info = normalizedInput.invoiceInfo;
    if (!info?.companyName?.trim() || !info?.taxCode?.trim() || !info?.invoiceAddress?.trim()) {
      throw new Error("Vui lòng nhập đầy đủ thông tin xuất hóa đơn");
    }
  }

  const normalizedUserId = normalizedInput.userId || (actor?.role === "user" ? actor.id : null);
  const orderSource = ["admin", "manage"].includes(actor?.role)
    ? "manual_entry"
    : "customer_self_service";

  return {
    madh: Number(normalizedInput.madh) > 0 ? Number(normalizedInput.madh) : nextOrderCode,
    customerName: normalizedInput.customerName.trim(),
    phone: normalizedInput.phone.trim(),
    address: normalizedInput.address.trim(),
    email: normalizedInput.email?.trim() || "",
    customerType: normalizedInput.customerType || "retail",
    orderSource,
    products,
    totalPrice,
    status: normalizedInput.status || "Xác nhận",
    payment: normalizedInput.payment || "COD",
    userId: normalizedUserId,
    voucherId: normalizedInput.voucherId,
    note: normalizedInput.note || "",
    isPaymentSucces: Boolean(normalizedInput.isPaymentSucces),
    invoiceRequested,
    invoiceInfo: {
      companyName: normalizedInput.invoiceInfo?.companyName?.trim() || "",
      taxCode: normalizedInput.invoiceInfo?.taxCode?.trim() || "",
      invoiceEmail: normalizedInput.invoiceInfo?.invoiceEmail?.trim() || "",
      invoiceAddress: normalizedInput.invoiceInfo?.invoiceAddress?.trim() || "",
      note: normalizedInput.invoiceInfo?.note?.trim() || "",
    },
  };
};

/**
 * Controllers
 */

export const GetOrder = async (req, res) => {
  try {
    const { search = "", status = "", payment = "", source = "" } = req.query;
    const filter = {};

    if (search) {
      const regex = new RegExp(search, "i");
      const searchAsNumber = Number(search);
      filter.$or = [
        ...(isNaN(searchAsNumber) ? [] : [{ madh: searchAsNumber }]),
        { customerName: regex },
        { phone: regex },
        { email: regex },
        { "invoiceInfo.companyName": regex },
      ];
    }

    if (status) filter.status = status;
    if (payment) filter.payment = payment;
    if (source) filter.orderSource = source;

    const data = await Order.find(filter)
      .populate("products.productId", "imageUrl")
      .sort({ createdAt: -1 });

    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const AddOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const orderInputs = normalizeOrdersPayload(req.body);
    if (orderInputs.length === 0) throw new Error("Dữ liệu trống");

    let nextOrderCode = await getNextOrderCode(session);
    const preparedOrders = [];

    for (const input of orderInputs) {
      const order = await buildOrderDocument(input, session, nextOrderCode, req.user);
      nextOrderCode = Number(order.madh) + 1;
      preparedOrders.push(order);
    }

    const createdOrders = await Order.create(preparedOrders, { session });
    await session.commitTransaction();

    return res.status(201).json({
      message: createdOrders.length > 1 ? `Tạo ${createdOrders.length} đơn thành công` : "Thành công",
      data: createdOrders,
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

export const UpdateOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const newStatus = req.body.status;
    const oldOrder = await Order.findById(id).session(session);

    if (!oldOrder) throw new Error("Không tìm thấy đơn hàng");

    // Xử lý hoàn kho khi Hủy
    if (newStatus === "Hủy" && oldOrder.status !== "Hủy") {
      for (const item of oldOrder.products) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { "variants.$[v].quantity": item.quantity } },
          {
            arrayFilters: [{ "v.color": item.color, "v.status": true }],
            session,
          }
        );

        const prod = await Product.findById(item.productId).session(session);
        if (prod) {
          const totalQty = prod.variants.reduce((sum, v) => sum + v.quantity, 0);
          await Product.updateOne({ _id: item.productId }, { quantity: totalQty }, { session });
        }
      }
    }

    const updated = await Order.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
      session,
    });

    await session.commitTransaction();
    return res.status(200).json(updated);
  } catch (error) {
    await session.abortTransaction();
    return res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

export const DetailOrder = async (req, res) => {
  try {
    const data = await Order.findById(req.params.id)
      .populate("products.productId", "imageUrl")
      .populate("handledBy", "username")
      .populate("voucherId", "code discount type");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const GetOrderByUser = async (req, res) => {
  try {
    const data = await Order.find({ userId: req.params.userid })
      .populate("products.productId", "imageUrl")
      .sort({ createdAt: -1 });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const DeleteOrder = async (req, res) => {
  try {
    const data = await Order.deleteMany({});
    return res.status(200).json({ message: "Đã xóa tất cả", result: data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};