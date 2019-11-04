const Web3 = require('web3');
const ethers = require('ethers');
const crypto = require('crypto');
const Transaction = require('ethereumjs-tx').Transaction;
const ethJsUtil = require('ethereumjs-util');
const request = require('request-promise');
const util = require('util');

const PubSub = require('./pubsub');
const BlockValidation = require('./block-validation');
const logger = require('./logger');

var args = require('yargs')
  .options({
    'ms': {
      default: 256,
      describe: 'size',
      type: 'number'
    },
    'mc': {
      default: 256,
      describe: 'size',
      type: 'number'
    },
    'mw': {
      default: 256,
      describe: 'size',
      type: 'number'
    },
    'ks': {
      default: 8,
      describe: 'bits',
      type: 'number'
    },
    'kc': {
      default: 8,
      describe: 'bits',
      type: 'number'
    },
    'kw': {
      default: 8,
      describe: 'bits',
      type: 'number'
    },
    'fs': {
      default: 0.5,
      describe: 'fill rate',
      type: 'number'
    },
    'fc': {
      default: 0.5,
      describe: 'fill rate',
      type: 'number'
    },
    'fw': {
      default: 0.5,
      describe: 'fill rate',
      type: 'number'
    },
    'd': {
      default: 60*60*1000,
      describe: 'duration',
      type: 'number'
    },
    's': {
      default: '127.0.0.1',
      describe: 'server',
      type: 'string'
    },
    'ND': {
      default: 100,
      describe: 'number of devices',
      type: 'number'
    },
    'test': {
      default: 'test',
      describe: 'test name',
      type: 'string'
    },


  })
  .argv
;

var contractAddress = '0x5C4e471d9c2ac9736C4b00E5E3072e5f02919853';
let provider = new ethers.providers.JsonRpcProvider('https://ropsten.infura.io/v3/2b32da7c679a43d1840be1845ff19ae8');
// Define the ABI (Application Binary Interface)
var filesys = require('fs');
var abi = JSON.parse(
  filesys.readFileSync('./ethereum/build/contracts/LightValidation.json', 'utf8')
).abi;

const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://ropsten.infura.io/ws/v3/2b32da7c679a43d1840be1845ff19ae8'));
let contractweb3 = new web3.eth.Contract(abi, contractAddress);
var myECDH;
var pubsub;

let ms = args.ms ;
let mc = args.mc ;
let mw = args.mw ;
let ks = args.ks ;
let kc = args.kc;
let kw = args.kw;
let fs = args.fs ;
let fc = args.fc ;
let fw = args.fw ;

let duration = args.d * 60 * 1000 ;
let redisIP = args.s;

let blockValidation = new BlockValidation(ms, ks, fs, mc, kc, fc, mw, kw, fw);

async function getPubkeyByAddress(address) {
  var filter = { device: address };
  let events = await contractweb3.getPastEvents('DeviceRegistered', { filter, fromBlock: 0, toBlock: 'latest' });
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
  let trueND = deviceList.length;
  for (i = 0; i < args.ND && passedDevices.length < 90 ; i++) {
    let device = deviceList[i % trueND];
    //console.log("Check", device);
    if (blockValidation.checkWhitelist(device+i, Bw) && device !== 0) {
      //console.log("passed");
      passedDevices.push(device);
      let devPubkey = await getPubkeyByAddress(device);
      //console.log(block,devPubkey.toString('hex'));
      let sharedSecret = myECDH.computeSecret(Buffer.concat([Buffer.from('04', 'hex'), devPubkey]));
      //console.log("secret", sharedSecret);
      secrets.push(sharedSecret);
    }
  }
  return { passedDevices, secrets };
}

async function getAccount(server) {
  var response = await request({ url: `http://${server}:3000`, method: 'GET' });
  logger.verbose(response);
  return JSON.parse(response);
}


async function main() {
  //if (process.argv.length > 2) redisIP = process.argv[2];
  logger.info("redis", redisIP);
  pubsub = new PubSub({ redisUrl: `redis://${redisIP}:6379` });

  var myAccount = await getAccount(redisIP);
  logger.info(myAccount.key);


  myECDH = crypto.createECDH('secp256k1');
  myECDH.setPrivateKey(myAccount.key.substring(2), 'hex');

  const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws/v3/2b32da7c679a43d1840be1845ff19ae8'));
  logger.info('Connected to Infura.');

  const subscription = web3.eth.subscribe('newBlockHeaders', (error, blockHeader) => {
    if (error) return logger.error(error);

    //logger.info('Successfully subscribed!', blockHeader.hash);
  }).on('data', async function (blockHeader) {
    logger.info(util.format('new block', blockHeader.hash));
    pubsub.updateLog(blockHeader.hash);
    let { passedDevices, secrets } = await prepareConfirmation(blockHeader.hash, myAccount.account);
    logger.verbose(util.format("passed devices:", passedDevices.length));
    let Bc = blockValidation.createConfirmation(blockHeader.hash, secrets);
    pubsub.broadcastMessage(JSON.stringify({ 'WITNESS': myAccount.account, 'Block': blockHeader.hash, 'Bc': Bc }));
    logger.verbose(JSON.stringify(Bc));
  });


}

main();

setTimeout(() => {
  // calculate some statistics
  //console.log(pubsub.logData);
  let numBlock = pubsub.logData.length;
  let numBlockwithConfirm = 0;
  let numConfirm = 0;
  let delay = 0;
  pubsub.logData.forEach(function (block) {
    logger.info(block.hash);
    numConfirm += block.confirmMsg.length;
    if (block.confirmMsg.length > 0) {

      numBlockwithConfirm++;
      delay += Math.max(...block.confirmMsg) - block.received;
    }
  });

  //logger.info('Task completed');
  logger.info('SUMMARY:');
  logger.info(ms, mc, mw, ks, kc, kw, fs, fc, fw, duration, redisIP);
  logger.info(util.format('Total blocks: ', numBlock));
  logger.info(util.format('Total blocks with confirmations: ', numBlockwithConfirm));
  logger.info(util.format('Average confirmations per block:', numConfirm / numBlockwithConfirm));
  logger.info(util.format('Average delay per block (ms)', delay / numBlockwithConfirm));
  setTimeout(() => {
    return process.exit(22);
  }, 5000);
}, duration);
