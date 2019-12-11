const BloomFilter = require('./bloom-filter');
const crypto = require('crypto');
const logger = require('./logger');
const util = require('util');
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
    let start = new Date();
    var Bc_array = [];
    Bc_array.push(new BloomFilter({ size: this.mc, fillRate: this.fc }));
    for (let s of secrets) {
      if (Bc_array[Bc_array.length-1].isFull()) Bc_array.push(new BloomFilter({ size: this.mc, fillRate: this.fc }));
      var Bc = Bc_array[Bc_array.length-1];
      const hmac = crypto.createHmac('sha256', s);
      hmac.update(block);
      const codeWord = hmac.digest();
      Bc.insert(codeWord, this.kc);
    }
    let end = new Date();
    logger.debug(util.format("create confirmations takes", (end-start)/1000))
    return Bc_array;
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
    let start = new Date();
    let Bw = new BloomFilter({size: this.mw, fillRate: this.fw} );
    let i = 0;
    while (Bw.countSetBits() < Bw.size * Bw.fillRate) {
      //let s = new Date();
      const hmac = crypto.createHmac('sha256', witnessID);
      hmac.update(i.toString());
      hmac.update(block);
      const codeWord = hmac.digest();
      Bw.insert(codeWord, this.kw);
      i++;
      //let e = new Date();
     // logger.debug(util.format("each iteration takes", (e-s)/1000));
    }
    let end = new Date();
    logger.debug(util.format("create whitelist takes", (end-start)/1000))
    //console.log("set bits ", Bw.countSetBits());
    return Bw;
  }

  chooseBw(ND) {
    const p = [
      [4.00000e-01, 1.60000e-01, 6.40000e-02, 2.56000e-02, 1.02400e-02, 4.09600e-03,
        1.63840e-03, 6.55360e-04, 2.62144e-04],
      [0.45,       0.2025,     0.091125,   0.04100625, 0.01845281, 0.00830377,
        0.00373669, 0.00168151, 0.00075668],
      [0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625, 0.0078125 , 0.00390625, 0.00195312],
        [0.55      , 0.3025    , 0.166375  , 0.09150625, 0.05032844,
      0.02768064, 0.01522435, 0.00837339, 0.00460537],
        [0.55      , 0.3025    , 0.166375  , 0.09150625, 0.05032844,
        0.02768064, 0.01522435, 0.00837339, 0.00460537],
        [0.65      , 0.4225    , 0.274625  , 0.17850625, 0.11602906,
          0.07541889, 0.04902228, 0.03186448, 0.02071191],
        [0.7       , 0.49      , 0.343     , 0.2401    , 0.16807   ,
            0.117649  , 0.0823543 , 0.05764801, 0.04035361],
        [0.75,       0.5625,     0.421875,   0.31640625, 0.23730469, 0.17797852,
            0.13348389, 0.10011292, 0.07508469]
    ];
    //console.log(p);
    //const pp = -Math.log(1-this.fc)*this.mc/ND/this.kc;
    const pp = 16/30;
    console.log(pp);
    var min_diff = 1000;
    for (let i = 0; i < p.length; i++) 
      for (let j = 0; j < p[0].length; j++) {
        var diff =  p[i][j] - pp;
        if (diff < min_diff && diff >= 0) {
          min_diff = diff;
          this.fw = p[i][0];
          this.kw = j+1;
          console.log(this.fw, this.kw, Math.pow(this.fw, this.kw)*ND );
        }
      }
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
    //console.log("Codeword", codeWord.toString('hex'));
    if (Bw.check(codeWord,this.kw))
      return true;
    return false;
  }

}

module.exports = BlockValidation;