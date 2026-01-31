const { createDriverV1 } = require("../driver-store");

function createDriver(req, res) {
  const driver = createDriverV1(req.body);
  return res.status(201).json(driver);
}

module.exports = {
  createDriver
};
