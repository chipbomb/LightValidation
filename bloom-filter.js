bigInt = require("big-integer");
const crypto = require('crypto');

class BloomFilter {
  constructor({ size, fillRate }) {
    this.fillRate = fillRate;
    this.size = size;
    this.intRep = bigInt();
    this.CHUNK_SIZE = Math.log(size)/Math.log(2);
    //this.isFull = false;
  }



  countSetBits() {
    let count = 0;
    let n = this.intRep;
    while (!n.isZero()) 
    { 
        count += n.and(1); 
        n = n.shiftRight(1); 
        //console.log(n);
    }
    return count;
  }

  isFull() {
    if (this.countSetBits()/this.size >= this.fillRate)
      return true;
    return false;
  }

  static bitArrayToInt32(bitArray) {
      let ret = 0; 
      let tmp;
      for (let i = 0; i < bitArray.length; i++) {
          tmp = bitArray[i];
          ret |= tmp << (i);
          //console.log("ret", ret);
      }
      return ret;
  }

  insert(itemHash, k) { // insert item using k bits; item is a 256 bit hash
    //console.log(itemHash.length);
    let chunk = new Array(this.CHUNK_SIZE).fill(false);
    let countBits = 0;
    for(let i = 0; i < itemHash.length && countBits < k ; ++i)
    {
      let cur = itemHash[i];
      let offset = i * 8;
      for(let bit = 0; bit < 8; ++bit)
      {
        chunk[offset % this.CHUNK_SIZE] = cur & 1;
        ++offset;   // Move to next bit in b
        if (offset % this.CHUNK_SIZE === 0) {
          let index = BloomFilter.bitArrayToInt32(chunk);
          let mask = bigInt(1).shiftLeft(index);
          this.intRep = this.intRep.or(mask);
          countBits++;
        }
        cur >>= 1;  // Move to next bit in array
      }
    }
    //console.log("bf", this.intRep);
  }

  check(itemHash, k) {
    let chunk = new Array(this.CHUNK_SIZE).fill(false);
    let countBits = 0;
    let countSetBits = 0;
    //console.log("itemHash", itemHash);
    for(let i = 0; i < itemHash.length && countBits < k ; ++i)
    {
      let cur = itemHash[i];
      let offset = i * 8;
      for(let bit = 0; bit < 8; ++bit)
      {
        chunk[offset % this.CHUNK_SIZE] = cur & 1;
        ++offset;   // Move to next bit in b
        if (offset % this.CHUNK_SIZE === 0) {
          let index = BloomFilter.bitArrayToInt32(chunk);
          //console.log(index);
          countBits++;
          let mask = bigInt(1).shiftLeft(index);
          //this.intRep = this.intRep.or(mask);

          //console.log("Whitelist ", this.intRep.toString(2));
          //console.log("Mask      ", mask.toString(2));
          if (!this.intRep.and(mask).isZero()) { // is set
            //console.log("matched");
            countSetBits++;
          }
          else {
            //return false;
          }
        }
        cur >>= 1;  // Move to next bit in array
      }
    }
    //console.log("countsetbits", countSetBits);
    if (countSetBits != k) return false;
    return true;
  }

}

module.exports = BloomFilter;