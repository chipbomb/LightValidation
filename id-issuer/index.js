const express = require('express');
const readline = require('readline');
const fs = require('fs');
const bodyParser = require('body-parser');

var app = express();

var logData = [];

// create application/json parser
app.use(bodyParser.json());

// create application/x-www-form-urlencoded parser
app.use(bodyParser.urlencoded({ extended: false }));

let bindIP = '127.0.0.1';
let count = 0;
if (process.argv.length > 2) bindIP = process.argv[2];
if (process.argv.length > 3) total = process.argv[3];
console.log("IP", bindIP);

var witnessAccounts = [];
var witnessKeys = [];
var requests = [];

function getWitnessAccounts() {
  const readInterface = readline.createInterface({
    input: fs.createReadStream('../witness_accounts.txt'),
    //output: process.stdout,
    console: false
  });
  readInterface.on('line', function (line) {
    witnessAccounts.push(line);
    //console.log('asdf',line);
  });
}

function getWitnessKeys() {
  const readInterface = readline.createInterface({
    input: fs.createReadStream('../witness_keys.txt'),
    //output: process.stdout,
    console: false
  });
  readInterface.on('line', function (line) {
    witnessKeys.push(line);
    //console.log('asdf',line);
  });
}

app.get('/', function (req, res) {
  var data = JSON.stringify({ account: witnessAccounts[count], key: witnessKeys[count] });
  count = (count + 1) % witnessKeys.length;
  res.send(data);
});

app.post('/Aggregation', function (req, res) {
  //console.log(req.body.data);
  let data = req.body.data;
  res.send('POST request to the homepage');
  var devices = data.Devices;

  devices.forEach(function (device) {
    var d = logData.find(obj => obj.id === device);
    if (!d) {
      let dev = {
        id: device,
        blocks: [{ hash: data.Block, count: 1 }]
      }
      logData.push(dev);
    }
    else {
      var block = d.blocks.find(obj => obj.block === data.Block);
      if (!block) {
        let block = {
          hash: data.Block,
          count: 1
        };
        d.blocks.push(block);
      }
      else
        block.count++; 
    }
  });
  //console.log(logData);
})

app.listen(3000, bindIP, function () {
  getWitnessAccounts();
  getWitnessKeys();
  //total = witnessAccounts.length;
  console.log('Example app listening on port 3000!');
});

setInterval(() => {

  //console.log("logdata", logData);
  console.log("Total devices:", logData.length);
  logData.forEach(function(device){
    let count = 0;
    for (i = 0; i < device.blocks.length; i++) {
      count += device.blocks[i].count;
    }
    console.log(device.id, count);
  });

}, 5 * 60 * 1000);