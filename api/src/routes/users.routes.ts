import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { usersCtrl } from "../controllers/users.ctrl";
import { asyncHandler } from "../utils/asyncHandler";

export const usersRouter = Router();

// list, create y update no tienen try/catch propio — se envuelven con asyncHandler.
// remove ya tiene try/catch interno, se deja sin envolver.
usersRouter.get("/", requireAuth, requireRole("ADMIN"), asyncHandler(usersCtrl.list));
usersRouter.post("/", requireAuth, requireRole("ADMIN"), asyncHandler(usersCtrl.create));
usersRouter.put("/:id", requireAuth, requireRole("ADMIN"), asyncHandler(usersCtrl.update));
usersRouter.delete("/:id", requireAuth, requireRole("ADMIN"), usersCtrl.remove);
