import type { Database } from "@/types/database";

export type DbTableName = keyof Database["public"]["Tables"];
export type DbRow<TTable extends DbTableName> =
  Database["public"]["Tables"][TTable]["Row"];
export type DbInsert<TTable extends DbTableName> =
  Database["public"]["Tables"][TTable]["Insert"];
export type DbUpdate<TTable extends DbTableName> =
  Database["public"]["Tables"][TTable]["Update"];

