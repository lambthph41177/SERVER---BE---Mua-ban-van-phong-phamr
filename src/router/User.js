import express from "express";

import {
  singup,
  updateUser,
  DeleteUser,
  GetUser,
  DetailUser,
  UpdatePassword,
  forceChangePassword,
  signin,
  refreshTokenHandler,
  logout,
  addUser,
  forgotPassword,
  resetPassword,
} from "../controller/user-joi";
import { checkout, checkManage, checkOwner, checkSelf } from "../xacthuc/checkout";
const router = express.Router();
router.post("/register", singup);
router.post("/addUser", checkManage, addUser);
router.get("/user", checkout, GetUser);
router.post("/logout", logout);
router.post("/login", signin);
router.post('/refresh-token', refreshTokenHandler);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.patch("/user/force-change-password/:id", checkSelf, forceChangePassword); // đặt trước /user/:id
router.patch("/user/pass/:id", checkSelf, UpdatePassword);
router.patch("/user/:id", checkOwner, updateUser);
router.delete("/user/:id", checkManage, DeleteUser);
router.get("/user/:id", checkOwner, DetailUser);
export default router;
