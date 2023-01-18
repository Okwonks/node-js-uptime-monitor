/*
 * A library for storing and rotating logs
 *
 */

// Deps
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Container for the module
const lib = {};

// Base directory of the logs
const baseDir = path.join(__dirname, '../.logs/');

// Append to the file. Create new file if it doesn't exit
lib.append = (file, str, cb) => {
  // Open the file for appending
  fs.open(`${baseDir}${file}.log`, 'a', (err, fd) => { // fd = file descriptor
    if(!err && fd) {
      fs.appendFile(fd, `${str}\n`, err => {
        if(err) {
          return cb('Appending failed!');
        }

        fs.close(fd, err => {
          if(err) {
            return cb('Could not close file');
          }

          cb(false);
        });
      });
    } else {
      cb('Appending failed!');
    }
  });
};

// List all the logs with option to add compressed logs
lib.list = (opts, cb) => {
  if(!cb && opts) {
    cb = opts;
    opts = { includeCompressed:false };
  }

  fs.readdir(baseDir, (err, data) => {
    if(!err && data?.length) {
      const trimmedFileNames = [];
      data.forEach(fileName => {
        const trimmedFileName = fileName.replace(/\..*/, '');

        if(fileName.includes('.log')) {
          trimmedFileNames.push(trimmedFileName);
        }

        if(opts.includeCompressed && fileName.includes('.gz.b64')) {
          trimmedFileNames.push(trimmedFileName);
        }
      });
      cb(false, trimmedFileNames);
    } else {
      cb(err, data);
    }
  });
};

lib.compress = (logId, compressedFileId, cb) => {
  const source = `${logId}.log`;
  const dest = `${compressedFileId}.gz.b64`;

  // Read source file
  fs.readFile(`${baseDir}${source}`, 'utf8', (err, sourceData) => {
    if(!err && sourceData) {
      // Compress data
      zlib.gzip(sourceData, (err, buffer) => {
        if(!err && buffer) {
          fs.open(`${baseDir}${dest}`, 'wx', (err, fd) => {
            if(!err && fd) {
              fs.writeFile(fd, buffer.toString('base64'), err => {
                if(!err) {
                  fs.close(fd, err => {
                    if(!err) {
                      cb(false);
                    } else {
                      cb(err);
                    }
                  });
                } else {
                  cb(err);
                }
              });
            } else {
              cb(err);
            }
          });
        } else {
          cb(err);
        }
      });
    } else {
      cb(err);
    }
  });
};

lib.decompress = (fileId, cb) => {
  const fileName = `${fileId}.gz.b64`;
  fs.readFile(`${baseDir}${fileName}`, 'utf8', (err, str) => {
    if(!err && str) {
      // Decompress the data
      const readBuffer = new Buffer.from(str, 'base64');
      zlib.unzip(readBuffer, (err, output) => {
        if(!err && output) {
          const unzipped = output.toString();
          cb(false, unzipped);
        } else {
          cb(err);
        }
      });
    } else {
      cb(err);
    }
  });
};

lib.truncate = (logId, cb) => {
  fs.truncate(`${baseDir}${logId}.log`, 0, err => {
    if(!err) {
      cb(false);
    } else {
      cb(err);
    }
  });
};

module.exports = lib;
