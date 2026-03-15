declare module "@vercel/postgres" {
  export type QueryResultRow = Record<string, unknown>;

  export interface QueryResult<R extends QueryResultRow = QueryResultRow> {
    rows: R[];
    rowCount: number;
  }

  export interface SqlTag {
    <R extends QueryResultRow = QueryResultRow>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<QueryResult<R>>;
  }

  export const sql: SqlTag;
}
