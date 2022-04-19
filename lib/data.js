/*
 * Library for stroing and editing data
 *
 */

// Dependencies
const fs = require('fs');
const path = require('path');

const helpers = require('./helpers');

const lib = {};

module.exports = lib;

// Base directory of the data folder
lib.baseDr = path.join(__dirname, '../.data/');

// Wirte data to a file
lib.create = (dir, file, data, cb) => {
  fs.open(`${lib.baseDr}${dir}/${file}.json`, 'wx', (err, fd) => {
    if(!err && fd) {
      // Convert data to a string
      const stringData = JSON.stringify(data);

      // Write to file and close it
      fs.writeFile(fd, stringData, err => {
        if(err) {
          return cb('Error writind data to file');
        }
        fs.close(fd, err => {
          if(err) {
            return cb('Error closing new file');
          }
          cb(false);
        });
      });
    } else {
      cb('Could not create new file, it may already exist');
    }
  });
};

// Read data from a file
lib.read = (dir, file, cb) => {
  fs.readFile(`${lib.baseDr}${dir}/${file}.json`, 'utf-8', (err, data) => {
    if(!err) {
      return cb(false, helpers.parseJson(data));
    }
    return cb(err, data);
  });
};

// Update data inside a file
lib.update = (dir, file, data, cb) => {
  // Open the file for loading
  fs.open(`${lib.baseDr}${dir}/${file}.json`, 'r+', (err, fd) => {
    if(err) {
      return cb('An error occured while opening the file');
    }

    const stringData = JSON.stringify(data);

    // Truncate the file
    fs.ftruncate(fd, err => {
      if(err) {
        return cb('Error truncating file');
      }

      // Write and close file
      fs.writeFile(fd, stringData, err => {
        if(err) {
          return cb('Error writing to file');
        }

        fs.close(fd, err => {
          if(err) {
            return cb('Error closing file');
          }
          
          cb(false);
        });
      });
    });
  });
};

lib.delete = (dir, file, cb) => {
  // Unlink the file
  fs.unlink(`${lib.baseDr}${dir}/${file}.json`, err => {
    if(err) {
      return cb('Error deleting file');
    }
    cb(false);
  });
};

lib.list = (dir, cb) => {
  fs.readdir(`${lib.baseDr}${dir}/`, (err, data) => {
    if(err) {
      return cb(err, data);
    }

    if(data && data.length > 0) {
      const trimmedFileNames = [];
      data.forEach(fileName => {
        trimmedFileNames.push(fileName.replace('.json', ''));
      });

      return cb(false, trimmedFileNames);
    }

    cb(new Error('Directory read failed'), data);
  });
