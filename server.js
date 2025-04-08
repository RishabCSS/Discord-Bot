const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Bot is alive and working!");
});

app.listen(port, () => {
  console.log(`🌐 Web server running on port ${port}`);
});

require('./index');
