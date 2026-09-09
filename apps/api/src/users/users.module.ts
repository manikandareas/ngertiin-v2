import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { AvatarService } from "./avatar.service.js";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";

@Module({
  imports: [AuthModule, InfrastructureModule],
  controllers: [UsersController],
  providers: [UsersService, AvatarService],
  exports: [UsersService, AvatarService],
})
export class UsersModule {}
