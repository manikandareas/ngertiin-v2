import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

export class DatabaseClient {
  readonly connection: Sql;
  readonly db: PostgresJsDatabase;

  constructor(databaseUrl: string) {
    this.connection = postgres(databaseUrl, {
      max: 5,
      prepare: false,
      connect_timeout: 5,
      idle_timeout: 20,
    });
    this.db = drizzle(this.connection);
  }

  async check(): Promise<void> {
    await this.connection`select 1`;
  }

  async close(): Promise<void> {
    await this.connection.end({ timeout: 5 });
  }
}
