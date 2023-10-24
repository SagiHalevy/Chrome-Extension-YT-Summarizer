const { RateLimiterMemory } = require("rate-limiter-flexible");

const rateLimiter = new RateLimiterMemory({
  points: 2,
  duration: 60,
});
//Limit requests to 2 per minute
const rateLimitMiddleware = (req, res, next) => {
  rateLimiter
    .consume(req.ip)
    .then(() => {
      next();
    })
    .catch(() => {
      const summary = {
        RATE_LIMIT_EXCEEDED:
          "Request limit exceeded. You can make up to 2 requests per minute. Please wait and try again.",
      };
      res.json({ summary });
    });
};

module.exports = rateLimitMiddleware;
