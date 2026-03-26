require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  dataPath: process.env.DATA_PATH || './data'
};
