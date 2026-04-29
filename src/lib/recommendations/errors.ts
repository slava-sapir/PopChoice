export class PublicError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}

export function getPublicErrorResponse(error: unknown) {
  if (error instanceof PublicError) {
    return {
      message: error.message,
      status: error.status,
    };
  }

  console.error(error);

  return {
    message: "We could not create recommendations right now. Please try again.",
    status: 500,
  };
}