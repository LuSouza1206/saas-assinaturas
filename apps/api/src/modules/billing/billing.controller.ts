import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { asyncHandler, AppError } from "../../lib/errors";
import { billingService } from "./billing.service";

export const billingRouter = Router();

billingRouter.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      throw new AppError(400, "Missing stripe-signature header");
    }

    const event = billingService.constructEvent(
      req.body as Buffer,
      signature
    );
    await billingService.handleWebhook(event);
    res.json({ received: true });
  })
);

export function stripeWebhookErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof Error && err.message.includes("Webhook")) {
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }
  next(err);
}
