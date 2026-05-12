const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message =
    err.isOperational || statusCode < 500 ? err.message : "Internal server error";

  if (statusCode >= 500) {
    console.error("Unhandled error:", err);
  }

  return res.status(statusCode).json({
    success: false,
    error: message,
  });
};

export default errorHandler;
