const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const cors = require("cors");
const rateLimitMiddleware = require("./middleware/rateLimiter");
const { getSummary } = require("./controller/summaryController");
require("dotenv").config();
app.use(
  //this should be before any middleware
  cors({
    origin: ["chrome-extension://bokafafkjfefkghmafmpapidlbeliacp"],
  })
);
app.use(rateLimitMiddleware);
app.use(bodyParser.json());

const port = process.env.PORT;

app.post("/getSummary", getSummary);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
