const redis = require('redis');
const logger = require('./logger');

const CHANNELS = {
  BLOCKCHAIN: 'BLOCKCHAIN',
  WITNESS: 'WITNESS',
  AGGREGATION: 'AGGREGATION'
};


class PubSub {
  constructor({ redisUrl, role }) {
    this.publisher = redis.createClient(redisUrl);
    this.subscriber = redis.createClient(redisUrl);

    this.subscribeToChannel();

    this.subscriber.on(
      'message',
      (channel, message) => this.handleMessage(channel, message)
    );
    this.logData = [];
    this.newNum = 0;
    this.selectionFactor = 0;
    this.role = role;
  }

  handleMessage(channel, message) {
    logger.info(`Message received. Channel: ${channel}. Message: ${message}.`);

    const parsedMessage = JSON.parse(message);

    switch (channel) {
      case CHANNELS.BLOCKCHAIN:
        this.newNum = parsedMessage.NEW;
        console.log(this.newNum);
        this.selectionFactor = parsedMessage.SELECTION;
        break;
      case CHANNELS.AGGREGATION:
        var block = this.logData.find(obj => obj.hash === parsedMessage.Block);
        var devices = parsedMessage.Devices;
        if (!block) {
          let block = {
            hash: parsedMessage.Block,
            devices: []
          };
          this.logData.push(block);
        }
        devices.forEach(function(device) {
          var d = this.logData[parsedMessage.Block].devices.find(obj => obj.id === device);
          if (!d) {
            let dev = {
              id: device,
              count: 1
            }
            logData[parsedMessage.Block].devices.push(dev)
          }
          else {
            logData[parsedMessage.Block].devices[device].count++;
          }
        });

        this.transactionPool.setTransaction(parsedMessage);
        break;
      case CHANNELS.WITNESS:
        var block = this.logData.find(obj => obj.hash === parsedMessage.Block);
        if (!block) {
          let block = {
            hash: parsedMessage.Block,
            broadcast: 0,
            received: 0,
            confirmMsg: [new Date().getTime()]
          };
          this.logData.push(block);
        }
        else {
          //console.log('found');
          block.confirmMsg.push(new Date().getTime());
        }
        //logger.verbose('received new confirmation');
        break;
      default:
        return;
    }
  }

  subscribeToChannel() {
    Object.values(CHANNELS).forEach((channel) => {
      this.subscriber.subscribe(channel);
    });
  }

  publish({ channel, message }) {
    this.publisher.publish(channel, message, () => {
      //logger.verbose("published message");
    });

  }

  disconnect() {
    Object.values(CHANNELS).forEach((channel) => {
      this.subscriber.unsubscribe(channel, () => logger.info("disconnect redis"));
    });
  }

  broadcastChain() {
    this.publish({
      channel: CHANNELS.BLOCKCHAIN,
      message: JSON.stringify(this.blockchain.chain)
    });
  }

  broadcastDevices(block, passedDevices) {
    this.publish({
      channel: CHANNELS.AGGREGATION,
      message: JSON.stringify({ Block: block, Devices: passedDevices})
    });
  }

  broadcastMessage(msg, blockHash) {
    this.publish({
      channel: CHANNELS.WITNESS,
      message: msg
    });
    let block = this.logData.find(obj => obj.hash === blockHash);
    block.broadcast = new Date().getTime();
    logger.verbose("broadcast confirmation")
  }

  broadcastUpdate(msg) {
    this.publish({
      channel: CHANNELS.BLOCKCHAIN,
      message: msg
    });
  }

  updateLog(blockHash) {
    let block = {
      hash: blockHash,
      broadcast: 0,
      received: new Date().getTime(),
      confirmMsg: []
    };
    this.logData.push(block);
  }
}

module.exports = PubSub;