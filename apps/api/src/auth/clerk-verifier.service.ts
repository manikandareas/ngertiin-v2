import { verifyToken } from "@clerk/backend";
import { Inject, Injectable } from "@nestjs/common";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import { API_ENV } from "../config.js";

@Injectable()
export class ClerkVerifierService {
  constructor(@Inject(API_ENV) private readonly environment: ApiEnvironment) {}

  verify(token: string): Promise<unknown> {
    return verifyToken(token, { secretKey: this.environment.CLERK_SECRET_KEY });
  }
}
