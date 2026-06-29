import { Role } from "../modules/auth/guards/jwt.guard";

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface User extends JwtPayload {}
    interface Request {
      user?: JwtPayload;
      tenantId?: string;
    }
  }
}

export {};
