import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";

export function tenantResolver(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (!req.user?.tenantId) {
    return next(new AppError(401, "Tenant context missing", "NO_TENANT"));
  }

  req.tenantId = req.user.tenantId;
  next();
}
