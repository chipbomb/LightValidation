const Web3 = require('web3');
const PubSub = require('./pubsub');
const BlockValidation = require('./block-validation');
const ethers = require('ethers');
const crypto = require('crypto');
const Transaction = require('ethereumjs-tx').Transaction;
const ethJsUtil = require('ethereumjs-util');
const request = require('request-promise');

var contractAddress = '0x5C4e471d9c2ac9736C4b00E5E3072e5f02919853';
let provider = new ethers.providers.JsonRpcProvider('https://ropsten.infura.io/v3/2b32da7c679a43d1840be1845ff19ae8');
// Define the ABI (Application Binary Interface)
var fs = require('fs');
var abi = JSON.parse(
  fs.readFileSync('./ethereum/build/contracts/LightValidation.json', 'utf8')
).abi;

const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://ropsten.infura.io/ws/v3/2b32da7c679a43d1840be1845ff19ae8'));
let contractweb3 = new web3.eth.Contract(abi,contractAddress);


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
      chainId: 3,
      r: tx.r,
      s: tx.s,
      v: tx.v,
  }, { chain: 'ropsten', hardfork: 'petersburg' }).getSenderPublicKey();
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

async function getAccount() {
  var response = await request( { url: 'http://127.0.0.1:3000', method:'GET' } );
  console.log(response);
  return JSON.parse(response);
}


async function main() {
  let redisIP = '127.0.0.1';
  if (process.argv.length > 2) redisIP = process.argv[2];
  console.log("redis",redisIP);
  const pubsub = new PubSub({ redisUrl: `redis://${redisIP}:6379` });
  
  var myAccount = await getAccount();
  console.log(myAccount.key);


  let myECDH = crypto.createECDH('secp256k1');
  myECDH.setPrivateKey(myAccount.key.substring(2),'hex');

  const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws/v3/2b32da7c679a43d1840be1845ff19ae8'));
  console.log('Connected to Infura.');

  const subscription = web3.eth.subscribe('newBlockHeaders', (error, blockHeader) => {
    if (error) return console.error(error);

    console.log('Successfully subscribed!', blockHeader);
  }).on('data', async function (blockHeader) {
    console.log('new block',blockHeader.hash);
    let {passedDevices, secrets} = await prepareConfirmation(blockHeader.hash, myAccount.account);
    console.log('for ', blockHeader.hash);
    console.log(passedDevices.length);
    let Bc = blockValidation.createConfirmation(blockHeader.hash, secrets);
    pubsub.broadcastMessage(JSON.stringify({ 'WITNESS': myAccount.account, 'Bc': Bc }));
    console.log(JSON.stringify(Bc));
  });

  console.log("done");

}

main();


