import express from "express";
import {
  CreateVoucher,
  DeleteVoucher,
  DetailVoucher,
  getAllVoucher,
  UpdateVoucher,
} from "../controller/voucher";
import { checkout, checkManage, checkUser } from "../xacthuc/checkout";

const router = express.Router();
router.get("/vouchers", checkUser, getAllVoucher);
router.post("/voucher", checkout, CreateVoucher);
router.patch("/voucher/:id", checkout, UpdateVoucher);
router.delete("/voucher/:id", checkManage, DeleteVoucher);
// Support both singular and plural paths; allow logged-in users to view voucher details
router.get("/voucher/:id", checkUser, DetailVoucher);
router.get("/vouchers/:id", checkUser, DetailVoucher);
export default router;
