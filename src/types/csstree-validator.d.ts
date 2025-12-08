declare module 'csstree-validator' {
  export interface ValidationError {
    line: number
    column: number
    message: string
  }

  export function validate(css: string): ValidationError[]
}
