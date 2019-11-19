const BloomFilter = require('./bloom-filter');
const crypto = require('crypto');

class BlockValidation {
  constructor(ms,ks,fs,mc,kc,fc,mw,kw,fw) {
    this.ms = ms;
    this.mc = mc;
    this.mw = mw;
    this.ks = ks;
    this.kc = kc;
    this.kw = kw;
    this.fs = fs;
    this.fc = fc;
    this.fw = fw;
  }

  createConfirmation(block, secrets) {
    let Bc = new BloomFilter({ size: this.mc, fillRate: this.fc });
    for (let s of secrets) {
      const hmac = crypto.createHmac('sha256', s);
      hmac.update(block);
      const codeWord = hmac.digest();
      Bc.insert(codeWord, this.kc);
    }
    return Bc;
  }

  createSelection(secret) {
    let Bs = new BloomFilter({ size: this.ms, fillRate: this.fs});
    let r = crypto.randomBytes(32).toString('hex');
    let i = 0;
    while (Bs.countSetBits() < Bs.size * Bs.fillRate) {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(i.toString());
      hmac.update(r);
      const codeWord = hmac.digest();
      Bs.insert(codeWord, this.ks);
      i++;
    }
    return Bs;
  }

  createWhitelist(block, witnessID) {
    let Bw = new BloomFilter({size: this.mw, fillRate: this.fw} );
    let i = 0;
    while (Bw.countSetBits() < Bw.size * Bw.fillRate) {
      const hmac = crypto.createHmac('sha256', witnessID);
      hmac.update(i.toString());
      hmac.update(block);
      const codeWord = hmac.digest();
      Bw.insert(codeWord, this.kw);
      i++;
    }
    //console.log("set bits ", Bw.countSetBits());
    return Bw;
  }

  selectByWeight({ witnessID, weight }, Bs) {
    let i = 0;
    let r = crypto.randomBytes(32).toString('hex');
    while (i < weight) {
      const hmac = crypto.createHmac('sha256', r);
      hmac.update(i.toString());
      hmac.update(witnessID);
      const codeWord = hmac.digest();
      if (Bs.check(codeWord, this.ks))
        return i;
      else
        i++;
    }
    return -1;
  }

  checkWhitelist(device, Bw) {
    const hash = crypto.createHash('sha256');
    hash.update(device);
    const codeWord = hash.digest();
    if (Bw.check(codeWord,this.kw))
      return true;
    return false;
  }

}

module.exports = BlockValidation;