const Web3 = require('web3');
const PubSub = require('./pubsub');
const BlockValidation = require('./block-validation');
const ethers = require('ethers');
const crypto = require('crypto');
const Transaction = require('ethereumjs-tx').Transaction;
const ethJsUtil = require('ethereumjs-util');
const request = require('request-promise');
const logger = require('./logger');
const util = require('util');

var contractAddress = '0x5C4e471d9c2ac9736C4b00E5E3072e5f02919853';
let provider = new ethers.providers.JsonRpcProvider('https://ropsten.infura.io/v3/2b32da7c679a43d1840be1845ff19ae8');
// Define the ABI (Application Binary Interface)
var fs = require('fs');
var abi = JSON.parse(
  fs.readFileSync('./ethereum/build/contracts/LightValidation.json', 'utf8')
).abi;

const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://ropsten.infura.io/ws/v3/2b32da7c679a43d1840be1845ff19ae8'));
let contractweb3 = new web3.eth.Contract(abi,contractAddress);
var myECDH;
var pubsub;

ms = 256;
mc = 256;
mw = 256;
ks = 8;
kc = 8;
kw = 8;
fs = 0.5;
fc = 0.5;
fw = 0.5;

let duration = 60 * 60 * 1000;
if (process.argv.length > 3) duration = process.argv[3] * 60 * 1000;

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
  logger.debug(util.format("Whitelist ", Bw.intRep.toString(2)));
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

async function getAccount(server) {
  var response = await request( { url: `http://${server}:3000`, method:'GET' } );
  logger.verbose(response);
  return JSON.parse(response);
}


async function main() {
  let redisIP = '127.0.0.1';
  if (process.argv.length > 2) redisIP = process.argv[2];
  logger.info("redis",redisIP);
  pubsub = new PubSub({ redisUrl: `redis://${redisIP}:6379` });
  
  var myAccount = await getAccount(redisIP);
  logger.info(myAccount.key);


  myECDH = crypto.createECDH('secp256k1');
  myECDH.setPrivateKey(myAccount.key.substring(2),'hex');

  const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws/v3/2b32da7c679a43d1840be1845ff19ae8'));
  logger.info('Connected to Infura.');

  const subscription = web3.eth.subscribe('newBlockHeaders', (error, blockHeader) => {
    if (error) return logger.error(error);

    //logger.info('Successfully subscribed!', blockHeader.hash);
  }).on('data', async function (blockHeader) {
    logger.info(util.format('new block',blockHeader.hash));
    pubsub.updateLog(blockHeader.hash);
    let {passedDevices, secrets} = await prepareConfirmation(blockHeader.hash, myAccount.account);
    logger.verbose(util.format("passed devices:", passedDevices.length));
    let Bc = blockValidation.createConfirmation(blockHeader.hash, secrets);
    pubsub.broadcastMessage(JSON.stringify({ 'WITNESS': myAccount.account, 'Block': blockHeader.hash, 'Bc': Bc }));
    logger.verbose(JSON.stringify(Bc));
  });


}

main();

setTimeout(() => {
  // calculate some statistics
  let numBlock = pubsub.logData.length;
  let numConfirm = 0;
  let delay = 0;
  pubsub.logData.forEach(function(block) {
    numConfirm += block.confirmMsg.length;
    delay += Math.max(...block.confirmMsg) - block.received;
  });
  logger.info('Task completed');
  logger.info('SUMMARY:');
  logger.info(util.format('Total blocks: ', pubsub.logData.length));
  logger.info(util.format('Average confirmations per block:', numConfirm/numBlock));
  logger.info(util.format('Average delay per block', delay/numBlock));
  return process.exit(22);
}, duration);
