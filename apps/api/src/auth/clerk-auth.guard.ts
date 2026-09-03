import { verifyToken } from "@clerk/backend";
import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import { user_stats, users } from "@ngertiin/database";
import { eq } from "drizzle-orm";
import { API_ENV } from "../config.js";
import { ProductError } from "../http/product-error.js";
import { setLocalUserId, type ProductRequest } from "../http/request-context.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

function bearerToken(request: ProductRequest): string {
  const authorization = request.headers.authorization;
  if (authorization === undefined) {
    throw new ProductError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication required",
      "A Clerk bearer token is required.",
    );
  }

  if (typeof authorization !== "string") {
    throw new ProductError(
      401,
      "AUTHENTICATION_INVALID",
      "Authentication invalid",
      "The bearer token is invalid or expired.",
    );
  }

  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match?.[1]) {
    throw new ProductError(
      401,
      "AUTHENTICATION_INVALID",
      "Authentication invalid",
      "The bearer token is invalid or expired.",
    );
  }
  return match[1];
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    @Inject(API_ENV) private readonly environment: ApiEnvironment,
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ProductRequest>();
    const token = bearerToken(request);

    let clerkUserId: string;
    try {
      const claims = await verifyToken(token, { secretKey: this.environment.CLERK_SECRET_KEY });
      if (typeof claims.sub !== "string" || claims.sub.length === 0) {
        throw new Error("Clerk token has no subject");
      }
      clerkUserId = claims.sub;
    } catch {
      throw new ProductError(
        401,
        "AUTHENTICATION_INVALID",
        "Authentication invalid",
        "The bearer token is invalid or expired.",
      );
    }

    const localUserId = await this.infrastructure.database.db.transaction(async (transaction) => {
      await transaction
        .insert(users)
        .values({ clerk_user_id: clerkUserId })
        .onConflictDoNothing({ target: users.clerk_user_id });

      const [user] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerk_user_id, clerkUserId))
        .limit(1);
      if (!user) {
        throw new Error("Local user provisioning did not return a user");
      }

      await transaction
        .insert(user_stats)
        .values({ user_id: user.id })
        .onConflictDoNothing({ target: user_stats.user_id });
      return user.id;
    });

    setLocalUserId(request, localUserId);
    return true;
  }
}
