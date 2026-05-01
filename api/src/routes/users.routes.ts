import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { usersCtrl } from "../controllers/users.ctrl";
import { asyncHandler } from "../utils/asyncHandler";

export const usersRouter = Router();

// CRUD base
usersRouter.get(    "/",    requireAuth, requireRole("ADMIN"), asyncHandler(usersCtrl.list));
usersRouter.post(   "/",    requireAuth, requireRole("ADMIN"), asyncHandler(usersCtrl.create));
usersRouter.put(    "/:id", requireAuth, requireRole("ADMIN"), asyncHandler(usersCtrl.update));
usersRouter.delete( "/:id", requireAuth, requireRole("ADMIN"), usersCtrl.remove); // tiene try/catch propio

// Gestión de estado y contraseña (lote autenticación endurecida)
usersRouter.patch("/:id/deactivate",    requireAuth, requireRole("ADMIN"), asyncHandler(usersCtrl.deactivate));
usersRouter.patch("/:id/activate",      requireAuth, requireRole("ADMIN"), asyncHandler(usersCtrl.activate));
usersRouter.post( "/:id/reset-password", requireAuth, requireRole("ADMIN"), asyncHandler(usersCtrl.resetPassword));
