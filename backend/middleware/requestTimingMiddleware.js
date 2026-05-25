const requestTimingMiddleware = (options = {}) => {
  const enabled = String(process.env.LOG_REQUESTS || "").toLowerCase() === "true";
  const slowMs = Number(process.env.LOG_SLOW_REQUEST_MS || options.slowMs || 500);

  return (req, res, next) => {
    if (!enabled) return next();

    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const end = process.hrtime.bigint();
      const ms = Number(end - start) / 1e6;
      const isSlow = ms >= slowMs;

      // Keep logs structured-ish for easy grep.
      const payload = {
        msg: isSlow ? "slow_request" : "request",
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ms: Math.round(ms),
      };

      // eslint-disable-next-line no-console
      console.log(JSON.stringify(payload));
    });

    next();
  };
};

module.exports = { requestTimingMiddleware };

