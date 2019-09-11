const Web3 = require('web3');
const fs = require('fs');
var Tx = require('ethereumjs-tx');
var ethers = require('ethers');
const readline = require('readline');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:7545'));

var contractAddress = '0xD7ba471d0699Ae77360118cf11Ba9E5A1d144006';
let provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:7545');
var abi = JSON.parse(
  fs.readFileSync('./ethereum/build/contracts/LightValidation.json', 'utf8')
).abi;
let contract = new ethers.Contract(contractAddress, abi, provider);
let privateKey = '0x4f612a2ae0662aa706874143e2927b4a17b97f1d412ba4f154e885f99a36a53d';




web3.eth.defaultAccount = '0x8160C459929572506424762e7a8e0f03A14af269';
//console.log(web3.eth.getTransactionCount('0x8160C459929572506424762e7a8e0f03A14af269'));

async function registerDevice(senderPrivateKey) {
  let wallet = new ethers.Wallet(senderPrivateKey, provider);
  let contractWithSigner = contract.connect(wallet);
  await contractWithSigner.registerDevice().catch(
    error => { console.log('caught', error.message); }
  );
}

async function registerWitness(senderPrivateKey) {
  let wallet = new ethers.Wallet(senderPrivateKey, provider);
  let contractWithSigner = contract.connect(wallet);
  await contractWithSigner.registerWitness({ value: 100000000  }).catch(
    error => { console.log('caught', error.message); }
  );
}

async function retireWitness(senderPrivateKey) {
  let wallet = new ethers.Wallet(senderPrivateKey, provider);
  let contractWithSigner = contract.connect(wallet);
  await contractWithSigner.retireWitness().catch(
    error => { console.log('caught', error.message); }
  );
}

async function makeTx(sender, receiver, amount) {
  let nonce = await web3.eth.getTransactionCount(sender);
  var rawTx = {
    nonce: nonce,
    to: receiver, 
    value: amount,
    chainId: 5777,
    gasPrice: 10000000000,
    gasLimit: 21000
  };
  return rawTx;
}

async function sendBatch(sender, Devices) {
  let Devices = [];

  var stream1 = fs.createWriteStream("device_accounts.txt", {flags:'w'});
  var stream2 = fs.createWriteStream("device_keys.txt", {flags:'w'});
  for (let i=0;i<100;i++) {
    Devices.push(web3.eth.accounts.create());
    stream1.write(Devices[i].address + '\n');
    stream2.write(Devices[i].privateKey + '\n');
  }
  stream1.end();
  stream2.end();
  for (let account of Devices) {
    let rawTx = await makeTx(sender, account.address, '2000000');
    console.log(rawTx);
    var tx = new Tx(rawTx);
    tx.sign(Buffer.from('4f612a2ae0662aa706874143e2927b4a17b97f1d412ba4f154e885f99a36a53d','hex'));
    var serializedTx = tx.serialize();
    web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
      .on('receipt', console.log);
  }
}

async function registerBatch() {
  const readInterface = readline.createInterface({
    input: fs.createReadStream('device_keys.txt'),
    //output: process.stdout,
    console: false
  });
  readInterface.on('line', async function(line) {
    await registerDevice(line);
    console.log('asdf',line);
  });
}

//sendBatch(web3.eth.defaultAccount, Devices);
registerBatch();

console.log('done');