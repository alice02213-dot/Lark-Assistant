import type { ErrorRequestHandler } from "express";

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const larkCode: number | undefined = (err as any).larkCode;
  const status = larkCode ? 502 : err.status ?? 500;
  const message = err.message ?? "Internal server error";

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(status).json({ error: message, ...(larkCode ? { larkCode } : {}) });
};

export default errorHandler;
