import { Inject, Injectable } from "@nestjs/common";
import type { Dashboard } from "@ngertiin/contracts/api";
import { ModulesService } from "../modules/modules.service.js";
import { UsersService } from "../users/users.service.js";

@Injectable()
export class DashboardService {
  constructor(
    @Inject(ModulesService) private readonly modules: ModulesService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async getDashboard(userId: string): Promise<Dashboard> {
    const [user, moduleData] = await Promise.all([
      this.users.getCurrentUser(userId),
      this.modules.getDashboardModules(userId),
    ]);
    return { ...moduleData, stats: user.stats };
  }
}
