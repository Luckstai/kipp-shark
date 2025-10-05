declare module "papaparse" {
  export interface ParseMeta {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
  }

  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row: number;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface ParseConfig<T> {
    header?: boolean;
    dynamicTyping?: boolean;
    skipEmptyLines?: boolean | "greedy";
    download?: boolean;
    complete?: (results: ParseResult<T>) => void;
  }

  export function parse<T = any>(
    input: string,
    config?: ParseConfig<T>
  ): ParseResult<T>;
}
