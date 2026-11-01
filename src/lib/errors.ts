export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const ValidationError = (message: string, fieldErrors?: FieldErrors) =>
  new AppError(message, 422, "validation_error", fieldErrors);
export const NotFoundError = (message = "Not found") => new AppError(message, 404, "not_found");
export const ForbiddenError = (message = "You do not have permission to perform this action.") =>
  new AppError(message, 403, "forbidden");
export const UnauthenticatedError = (message = "Authentication required.") =>
  new AppError(message, 401, "unauthenticated");
export const ConflictError = (message: string) => new AppError(message, 409, "conflict");
export const RateLimitedError = (
  message = "Too many requests. Please wait a moment and try again.",
) => new AppError(message, 429, "rate_limited");

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
