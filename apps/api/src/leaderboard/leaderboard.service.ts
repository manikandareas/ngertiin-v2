import { Inject, Injectable } from "@nestjs/common";
import { type Leaderboard, leaderboardSchema } from "@ngertiin/contracts/api";
import { sql } from "drizzle-orm";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { AvatarService } from "../users/avatar.service.js";

@Injectable()
export class LeaderboardService {
  constructor(
    @Inject(AvatarService) private readonly avatars: AvatarService,
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  async getLeaderboard(userId: string): Promise<Leaderboard> {
    // One statement gives the list, own rank and clock the same MVCC snapshot.
    const [row] = await this.infrastructure.database.db.execute(sql`
      with instant as materialized (select statement_timestamp() as now),
      ranked as materialized (
        select s.user_id, coalesce(nullif(btrim(u.display_name), ''), 'Pelajar') as name,
          u.avatar_url, u.avatar_object_key, s.leaderboard_xp as score, s.leaderboard_expires_at as expires_at,
          rank() over (order by s.leaderboard_xp desc)::integer as rank
        from user_stats s join users u on u.id = s.user_id cross join instant
        where s.leaderboard_xp > 0 and s.leaderboard_expires_at > instant.now
      ), top as (select * from ranked order by score desc, user_id limit 50)
      select jsonb_build_object(
        'serverTime', instant.now,
        'inactivityDays', 7,
        'nextExpiresAt', (select min(expires_at) from ranked),
        'participants', coalesce((select jsonb_agg(jsonb_build_object(
          'userId', user_id, 'displayName', name, 'avatarUrl', avatar_url, 'avatarObjectKey', avatar_object_key, 'score', score, 'rank', rank
        ) order by score desc, user_id) from top), '[]'::jsonb),
        'self', jsonb_build_object('userId', ${userId}::uuid,
          'score', coalesce((select score from ranked where user_id = ${userId}::uuid), 0),
          'rank', (select rank from ranked where user_id = ${userId}::uuid),
          'expiresAt', (select leaderboard_expires_at from user_stats where user_id = ${userId}::uuid))
      ) as data from instant
    `);
    // PostgreSQL JSON timestamps include an offset; normalize to the public UTC format.
    const data = row?.data as Omit<Leaderboard, "participants"> & {
      participants: (Leaderboard["participants"][number] & { avatarObjectKey: string | null })[];
    };
    return leaderboardSchema.parse({
      ...data,
      participants: await Promise.all(
        data.participants.map(async ({ avatarObjectKey, ...person }) => ({
          ...person,
          avatarUrl: await this.avatars.resolve(avatarObjectKey, person.avatarUrl),
        })),
      ),
      serverTime: new Date(data.serverTime).toISOString(),
      nextExpiresAt: data.nextExpiresAt ? new Date(data.nextExpiresAt).toISOString() : null,
      self: {
        ...data.self,
        expiresAt: data.self.expiresAt ? new Date(data.self.expiresAt).toISOString() : null,
      },
    });
  }
}
