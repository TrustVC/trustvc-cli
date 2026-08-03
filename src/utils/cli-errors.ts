// CLI error helpers: turn caught errors into clear messages for the user.

export type ErrnoException = NodeJS.ErrnoException;

export type CliErrorOptions = {
  defaultMessage: string;
  fileNotFound?: string; // use {path} for the path
  permissionDenied?: string; // use {path} for the path
  invalidJson?: (syntaxMessage: string) => string;
};

const DEFAULT_PATH_PLACEHOLDER = 'the specified path';

export function isErrnoException(err: unknown): err is ErrnoException {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as ErrnoException).code === 'string'
  );
}

export function isSyntaxError(err: unknown): err is SyntaxError {
  return err instanceof SyntaxError;
}

export function isErrorWithMessage(err: unknown): err is Error & { message: string } {
  return err instanceof Error && typeof err.message === 'string';
}

/** Picks a user-facing message from options based on error type (ENOENT, EACCES, SyntaxError, or fallback). */
export function getCliErrorMessage(err: unknown, options: CliErrorOptions): string {
  if (isErrnoException(err)) {
    const path = err.path ?? DEFAULT_PATH_PLACEHOLDER;
    if (err.code === 'ENOENT' && options.fileNotFound) {
      return options.fileNotFound.replace('{path}', String(path));
    }
    if (err.code === 'EACCES' && options.permissionDenied) {
      return options.permissionDenied.replace('{path}', String(path));
    }
  }

  if (isSyntaxError(err) && options.invalidJson) {
    return options.invalidJson(err.message);
  }

  if (isErrorWithMessage(err)) {
    return err.message;
  }

  return options.defaultMessage;
}
