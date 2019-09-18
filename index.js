const Web3 = require('web3');
const PubSub = require('./pubsub');
const BlockValidation = require('./block-validation');
const ethers = require('ethers');
const crypto = require('crypto');
const Transaction = require('ethereumjs-tx');
const ethJsUtil = require('ethereumjs-util');

var contractAddress = '0x5C4e471d9c2ac9736C4b00E5E3072e5f02919853';
let provider = new ethers.providers.JsonRpcProvider('https://ropsten.infura.io/v3/2b32da7c679a43d1840be1845ff19ae8');
// Define the ABI (Application Binary Interface)
var fs = require('fs');
var abi = JSON.parse(
  fs.readFileSync('./ethereum/build/contracts/LightValidation.json', 'utf8')
).abi;

// contract object
//const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:7545'));
//let contractweb3 = web3.eth.Contract(abi,contractAddress);
let contract = new ethers.Contract(contractAddress, abi, provider);
let privateKey = '0x7821dbd2d2ad113c4dc75d4a3f64b5635184ea47e8bdb448e8e260eea36d24b5';
const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://ropsten.infura.io/ws'));
let contractweb3 = web3.eth.Contract(abi,contractAddress);
let myECDH = crypto.createECDH('secp256k1');
myECDH.setPrivateKey('7821dbd2d2ad113c4dc75d4a3f64b5635184ea47e8bdb448e8e260eea36d24b5','hex');

ms = 256;
mc = 256;
mw = 256;
ks = 8;
kc = 8;
kw = 8;
fs = 0.5;
fc = 0.5;
fw = 0.5;

let blockValidation = new BlockValidation(ms,ks,fs,mc,kc,fc,mw,kw,fw);

async function getPubkeyByAddress(address) {
  var filter = { device: address };
  let events = await contractweb3.getPastEvents('DeviceRegistered', { filter,fromBlock: 0,toBlock: 'latest'});
  var txHash = events[0].transactionHash;
  var tx = await web3.eth.getTransaction(txHash);
  //console.log(address, txHash);
  const pk = new Transaction({
      nonce: tx.nonce,
      gasPrice: ethJsUtil.bufferToHex(new ethJsUtil.BN(tx.gasPrice)),
      gasLimit: tx.gas,
      to: tx.to,
      value: ethJsUtil.bufferToHex(new ethJsUtil.BN(tx.value)),
      data: tx.input,
      chainId: 5777,
      r: tx.r,
      s: tx.s,
      v: tx.v,
  }).getSenderPublicKey();
  return pk; 
}

async function prepareConfirmation(block, witnessID) {
  let Bw = blockValidation.createWhitelist(block, witnessID);
  console.log("Whitelist ", Bw.intRep.toString(2));
  let deviceList = await contractweb3.methods.getDeviceList().call();
  let passedDevices = [];
  let secrets = [];
  //console.log(deviceList);
  for (let device of deviceList) {
    //console.log("Check", device);
    if (blockValidation.checkWhitelist(device, Bw) && device !== 0) {
      //console.log("passed");
      passedDevices.push(device);
      let devPubkey = await getPubkeyByAddress(device);
      //console.log(block,devPubkey.toString('hex'));
      let sharedSecret = myECDH.computeSecret(Buffer.concat([Buffer.from('04','hex'), devPubkey]));
      //console.log("secret", sharedSecret);
      secrets.push(sharedSecret);
    }
  }
  return {passedDevices, secrets};
}



async function main() {
  const pubsub = new PubSub({ redisUrl: 'redis://127.0.0.1:6379' });

  //await registerWitness();
  //await registerDevice();

  //console.log(deviceList);
  //let Bs = blockValidation.createSelection('khdsiji');
  const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws'));
  console.log('Connected to Infura.');

  const subscription = web3.eth.subscribe('newBlockHeaders', (error, blockHeader) => {
    if (error) return console.error(error);

    console.log('Successfully subscribed!', blockHeader);
  }).on('data', async function (blockHeader) {
   // pubsub.broadcastMessage();
    console.log('new block',blockHeader.hash);
    let {passedDevices, secrets} = await prepareConfirmation(blockHeader.hash, '0x7c28Bd7998B03a6Aeb516f35c448C76eDb3b7245');
    console.log('for ', blockHeader.hash);
    console.log(passedDevices.length);
    let Bc = blockValidation.createConfirmation(blockHeader.hash, secrets);
    pubsub.broadcastMessage(JSON.stringify(Bc));
    console.log(JSON.stringify(Bc));
  });

  console.log("done");

}

main();


// let bf = new BloomFilter({ size:1024, fillRate: 0.5 });
// bf.insert("hello",10);

// const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws'));
// const pubsub = new PubSub({ redisUrl: 'redis://127.0.0.1:6379' });

// console.log('Connected to Infura.');
// const subscription = web3.eth.subscribe('newBlockHeaders', (error, blockHeader) => {
//   if (error) return console.error(error);

//   console.log('Successfully subscribed!', blockHeader);
// }).on('data', (blockHeader) => {
//   pubsub.broadcastMessage();
//   console.log('new block');
// });

// unsubscribes the subscription
// subscription.unsubscribe((error, success) => {
// if (error) return console.error(error);

// console.log('Successfully unsubscribed!');
// });