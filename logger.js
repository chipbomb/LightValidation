const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

const fs = require('fs');
const path = require('path');
const os = require('os');
require('winston-daily-rotate-file');

const env = process.env.NODE_ENV || 'development';
const logDir = `/home/cc/my_mounting_point/${os.hostname()}`;

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const dailyRotateFileTransport = new transports.DailyRotateFile({
    filename: `${logDir}/%DATE%-results.log`,
    datePattern: 'YYYY-MM-DD',
    level: 'debug'
  });

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const logger = createLogger({
  // change level if in dev environment versus production
  level: env === 'production' ? 'info' : 'debug',
  format: combine(
    label({ label: path.basename(process.mainModule.filename) }),
    timestamp(),
    myFormat
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        myFormat
      )
    }),
    dailyRotateFileTransport
  ]
});

module.exports = logger;