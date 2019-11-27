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
      default: 60,
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

let ms = args.ms;
let mc = args.mc;
let mw = args.mw;
let ks = args.ks;
let kc = args.kc;
let kw = args.kw;
let fs = args.fs;
let fc = args.fc;
let fw = args.fw;

let duration = args.d * 60 * 1000;
let redisIP = args.s;

let blockValidation = new BlockValidation(ms, ks, fs, mc, kc, fc, mw, kw, fw);

var sharedSecrets = {};
var subscription;
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

async function computeSharedSecrets(ND) {
  let secrets = [];
  for (let i = 0; i < ND; i++) {
    console.log(i);
    let deviceList = await contractweb3.methods.getDeviceList().call();
    let trueND = deviceList.length;
    let device = deviceList[i % trueND];
    let devPubkey = await getPubkeyByAddress(device);
    let sharedSecret = myECDH.computeSecret(Buffer.concat([Buffer.from('04', 'hex'), devPubkey]));
    secrets.push(sharedSecret);
  }
  return secrets;
}


async function prepareConfirmation(block, witnessID) {
  let Bw = blockValidation.createWhitelist(block, witnessID);
  //logger.debug(util.format("Whitelist ", Bw.intRep.toString(2)));
  let deviceList = await contractweb3.methods.getDeviceList().call();
  let passedDevices = [];
  let secrets = [];
  let trueND = deviceList.length;
  for (var i = 0; i < args.ND; i++) {
    let device = deviceList[i % trueND];
    //console.log("Check", i);
    if (blockValidation.checkWhitelist(device + i + block, Bw) && device !== 0) {
      //console.log("passed");
      passedDevices.push(device);
      var s;
      if (!(device in sharedSecrets)) {
        let devPubkey = await getPubkeyByAddress(device);
        //console.log(block,devPubkey.toString('hex'));
        s = myECDH.computeSecret(Buffer.concat([Buffer.from('04', 'hex'), devPubkey]));
        sharedSecrets[device] = s;
      }
      else
        s = sharedSecrets[device];

      //console.log("secret", s);
      secrets.push(s);
    }
  }
  logger.debug(util.format("Done check", i, block));
  return { passedDevices, secrets };
}

async function getAccount(server) {
  var response = await request({ url: `http://${server}:3000`, method: 'GET' });
  logger.verbose(response);
  return JSON.parse(response);
}


async function main() {
  //if (process.argv.length > 2) redisIP = process.argv[2];
  logger.info(util.format("redis", redisIP));
  blockValidation.chooseBw(args.ND);
  logger.info(util.format('Bw params:', blockValidation.fw, blockValidation.mw, blockValidation.kw));
  pubsub = new PubSub({ redisUrl: `redis://${redisIP}:6379` });

  var myAccount = await getAccount(redisIP);
  logger.info(myAccount.key);

  myECDH = crypto.createECDH('secp256k1');
  myECDH.setPrivateKey(myAccount.key.substring(2), 'hex');
  //sharedSecrets = await computeSharedSecrets(args.ND);

  const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws/v3/2b32da7c679a43d1840be1845ff19ae8'));
  logger.info('Connected to Infura.');

  subscription = web3.eth.subscribe('newBlockHeaders', (error, blockHeader) => {
    if (error) return logger.error(error);

    //logger.info('Successfully subscribed!', blockHeader.hash);
  }).on('data', function (blockHeader) {
    logger.info(util.format('new block', blockHeader.hash));
    pubsub.updateLog(blockHeader.hash);
    prepareConfirmation(blockHeader.hash, myAccount.account).then(function ({ passedDevices, secrets }) {
      logger.verbose(util.format("passed devices:", passedDevices.length));
      let Bc = blockValidation.createConfirmation(blockHeader.hash, secrets);
      pubsub.broadcastMessage(JSON.stringify({ 'WITNESS': myAccount.account, 'Block': blockHeader.hash, 'Bc': Bc }));
    });
    // let { passedDevices, secrets } = await prepareConfirmation(blockHeader.hash, myAccount.account);
    // logger.verbose(util.format("passed devices:", passedDevices.length));
    // let Bc = blockValidation.createConfirmation(blockHeader.hash, secrets);
    // pubsub.broadcastMessage(JSON.stringify({ 'WITNESS': myAccount.account, 'Block': blockHeader.hash, 'Bc': Bc }));

  });


}

main();

setTimeout(() => {
  // calculate some statistics
  //console.log(pubsub.logData);
  subscription.unsubscribe(function (error, success) {
    if (success)
      console.log('Stop listening...');
  });
  let numBlock = pubsub.logData.length;
  let numBlockwithConfirm = 0;
  let numConfirm = 0;
  let delay = 0;
  for (i = 2; i < pubsub.logData.length - 2; i++) {
    var block = pubsub.logData[i];

    numConfirm += block.confirmMsg.length;
    if (block.confirmMsg.length > 0 && block.received > 0) {
      logger.verbose(util.format(block.hash, Math.max(...block.confirmMsg), block.received));
      numBlockwithConfirm++;
      delay += Math.max(...block.confirmMsg) - block.received;
    }
  }

  //logger.info('Task completed');
  logger.info('SUMMARY:');
  logger.info(util.format(ms, mc, mw, ks, kc, kw, fs, fc, fw, duration, redisIP));
  logger.info(util.format('Total blocks: ', numBlock));
  logger.info(util.format('Total blocks with confirmations: ', numBlockwithConfirm));
  logger.info(util.format('Average confirmations per block:', numConfirm / numBlockwithConfirm));
  logger.info(util.format('Average delay per block (ms)', delay / numBlockwithConfirm));
  setTimeout(() => {
    return process.exit(22);
  }, 5000);
}, duration);
