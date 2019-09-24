const express = require('express');
const readline = require('readline');
const fs = require('fs');
var app = express();
let bindIP = '127.0.0.1';
let count = 0;
if (process.argv.length > 2) bindIP = process.argv[2];
if (process.argv.length > 3) total = process.argv[3];
console.log("IP",bindIP);

var witnessAccounts = [];
var witnessKeys = [];
var requests = [];

function getWitnessAccounts() {
  const readInterface = readline.createInterface({
    input: fs.createReadStream('../witness_accounts.txt'),
    //output: process.stdout,
    console: false
  });
  readInterface.on('line', function(line) {
    witnessAccounts.push(line);
    console.log('asdf',line);
  });
}

function getWitnessKeys() {
  const readInterface = readline.createInterface({
    input: fs.createReadStream('../witness_keys.txt'),
    //output: process.stdout,
    console: false
  });
  readInterface.on('line', function(line) {
    witnessKeys.push(line);
    console.log('asdf',line);
  });
}

app.get('/', function (req, res) {
  var data = JSON.stringify({account: witnessAccounts[count], key: witnessKeys[count]});
  count = (count + 1) % witnessKeys.length;
  res.send(data);
});

app.listen(3000, bindIP, function () {
  getWitnessAccounts();
  getWitnessKeys();
  //total = witnessAccounts.length;
  console.log('Example app listening on port 3000!');
});