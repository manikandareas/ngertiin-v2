import type { ExtractTablesWithRelations } from "drizzle-orm";
import {
  drizzle,
  type PostgresJsDatabase,
  type PostgresJsTransaction,
} from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";

export type DatabaseTransaction = PostgresJsTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export class DatabaseClient {
  readonly connection: Sql;
  readonly db: PostgresJsDatabase<typeof schema>;

  constructor(databaseUrl: string) {
    this.connection = postgres(databaseUrl, {
      max: 5,
      prepare: false,
      connect_timeout: 5,
      idle_timeout: 20,
    });
    this.db = drizzle(this.connection, { schema });
  }

  async check(): Promise<void> {
    await this.connection`select 1`;
  }

  async close(): Promise<void> {
    await this.connection.end({ timeout: 5 });
  }
}
