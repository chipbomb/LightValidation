const redis = require('redis');
const logger = require('./logger');

const CHANNELS = {
  BLOCKCHAIN: 'BLOCKCHAIN',
  WITNESS: 'WITNESS'
};


class PubSub {
  constructor({ redisUrl }) {
    this.publisher = redis.createClient(redisUrl);
    this.subscriber = redis.createClient(redisUrl);

    this.subscribeToChannel();

    this.subscriber.on(
      'message', 
      (channel, message) => this.handleMessage(channel, message)
    );
    this.logData = [];
  }

  handleMessage(channel, message) {
    logger.info(`Message received. Channel: ${channel}. Message: ${message}.`);

    const parsedMessage = JSON.parse(message);

    switch(channel) {
      case CHANNELS.BLOCKCHAIN:
        this.blockchain.replaceChain(parsedMessage, true, () => {
          this.transactionPool.clearBlockchainTransactions({
            chain: parsedMessage
          });
        });
        break;
      case CHANNELS.TRANSACTION:
        this.transactionPool.setTransaction(parsedMessage);
        break;
      case CHANNELS.WITNESS:
        var block = this.logData.find(obj => obj.hash === parsedMessage.Block);
        if (!block) {
          let block = {
            hash: parsedMessage.Block,
            broadcast: 0,
            received: 0,
            confirmMsg: [ new Date().getTime()]
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
    this.subscriber.unsubscribe(channel, () => {
      this.publisher.publish(channel, message, () => {
        this.subscriber.subscribe(channel);
      });
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

  broadcastTransaction(transaction) {
    this.publish({
      channel: CHANNELS.TRANSACTION,
      message: JSON.stringify(transaction)
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