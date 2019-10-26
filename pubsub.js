const redis = require('redis');
const logger = require('./logger');

const CHANNELS = {
  TEST: 'TEST',
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
        if (!this.logData.find(obj => obj.hash === parsedMessage.Block)) {
          let block = {
            hash: parsedMessage.Block,
            received: 0,
            confirmMsg: [new Date().getTime()]
          };
          this.logData.push(block);
        }
        else
          this.logData[parsedMessage.Block].confirmMsg.push(new Date().getTime);
       
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

  broadcastMessage(msg) {
    this.publish({
      channel: CHANNELS.WITNESS,
      message: msg
    });
    logger.verbose("broadcast confirmation")
  }

  updateLog(blockHash) {
    let block = {
      hash: blockHash,
      received: new Date().getTime(),
      confirmMsg: []
    };
    this.logData.push(block);
  }
}

module.exports = PubSub;