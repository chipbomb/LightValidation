bigInt = require("big-integer");
const crypto = require('crypto');

class BloomFilter {
  constructor({ size, fillRate }) {
    this.fillRate = fillRate;
    this.size = size;
    this.intRep = bigInt();
    this.filter = new Uint8Array (size / 8);
    this.CHUNK_SIZE = Math.log(size) / Math.log(2);
    //this.isFull = false;
  }



  countSetBits() {
    let count = 0;
    for (let i = 0; i < this.size; i++) {
      if (this.getBit(i)) count++;
    }
    // let n = this.intRep;
    // while (!n.isZero()) {
    //   count += n.and(1);
    //   n = n.shiftRight(1);
    //   //console.log(n);
    // }
    return count;
  }

  isFull() {
    if (this.countSetBits() / this.size >= this.fillRate)
      return true;
    return false;
  }

  setBit(bitIndex) {
    let byteIndex = Math.floor(bitIndex / 8);
    let realIndex = bitIndex % 8;
    this.filter[byteIndex] = this.filter[byteIndex] | (1 << (7 - realIndex));
    //console.log(realIndex, this.filter[byteIndex]);
  }

  getBit(bitIndex) {
    let byteIndex = Math.floor(bitIndex / 8);
    let realIndex = bitIndex % 8;
    return ((this.filter[byteIndex] >> (7 - realIndex)) & 1);
  }

  toHexString() {
    var s = '', h = '0123456789ABCDEF';
    this.filter.forEach((v) => { s += h[v >> 4] + h[v & 15]; });
    //console.log(s);
    return s;
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
    //let start = new Date();
    //let chunk = new Array(this.CHUNK_SIZE).fill(false);
    let chunk = 0;
    let chunkNum = 0;
    //console.log(itemHash);
    for (let i = 0; i < itemHash.length * 8 && chunkNum < k; i++) {
      if (i % this.CHUNK_SIZE === 0 && i > 0) {
        //console.log(chunk.toString(16))
        //let mask = bigInt(1).shiftLeft(chunk);
        this.setBit(chunk);
        // console.log(this.filter);
        //this.intRep = this.intRep.or(mask);
        //console.log("Mask ", this.intRep.toString(2));
        chunkNum++;
        chunk = 0;
      }
      let byteIndex = Math.floor(i / 8);
      let bitIndex = i % 8;
      let byte = itemHash[byteIndex];
      let bit = (byte >> (7 - bitIndex)) & 1;
      // console.log(i, byteIndex, byte, bitIndex, bit, this.CHUNK_SIZE);
      chunk = chunk | (bit << (i % this.CHUNK_SIZE));

    }

    // for(let i = 0; i < itemHash.length && countBits < k ; ++i)
    // {
    //   let cur = itemHash[i];
    //   let offset = i * 8;
    //   for(let bit = 0; bit < 8; ++bit)
    //   { //1011001
    //     chunk = chunk | ((cur & 1) << offset);
    //     //chunk[offset % this.CHUNK_SIZE] = cur & 1;
    //     ++offset;   // Move to next bit in b
    //     if (offset % this.CHUNK_SIZE === 0) {
    //       let index = chunk;
    //       console.log(chunk, offset, itemHash.length);
    //       //let index = BloomFilter.bitArrayToInt32(chunk);
    //       let mask = bigInt(1).shiftLeft(index);
    //       this.intRep = this.intRep.or(mask);
    //       countBits++;
    //       chunk = 0
    //       offset = 0;
    //       //console.log(countBits);
    //     }
    //     cur >>= 1;  // Move to next bit in array
    //   }
    // }
    //let end = new Date();
    //console.log("-------------------set bits after insert takes", this.countSetBits(), (end-start)/1000);
    //console.log("bf", this.intRep);
  }

  check(itemHash, k) {
    let chunk = new Array(this.CHUNK_SIZE).fill(false);
    let chunkNum = 0;
    let countSetBits = 0;
    for (let i = 0; i < itemHash.length * 8 && chunkNum < k; i++) {
      if (i % this.CHUNK_SIZE === 0 && i > 0) {
        //console.log(chunk.toString(16))
        //let mask = bigInt(1).shiftLeft(chunk);
        if (this.getBit(chunk))
          countSetBits++;
        //this.intRep = this.intRep.or(mask);
        //console.log("Mask ", this.intRep.toString(2));
        chunkNum++;
        chunk = 0;
      }
      let byteIndex = Math.floor(i / 8);
      let bitIndex = i % 8;
      let byte = itemHash[byteIndex];
      let bit = (byte >> (7 - bitIndex)) & 1;
      // console.log(i, byteIndex, byte, bitIndex, bit, this.CHUNK_SIZE);
      chunk = chunk | (bit << (i % this.CHUNK_SIZE));

    }
    // //console.log("itemHash", itemHash);
    // for (let i = 0; i < itemHash.length && countBits < k; ++i) {
    //   let cur = itemHash[i];
    //   let offset = i * 8;
    //   for (let bit = 0; bit < 8; ++bit) {
    //     chunk[offset % this.CHUNK_SIZE] = cur & 1;
    //     ++offset;   // Move to next bit in b
    //     if (offset % this.CHUNK_SIZE === 0) {
    //       let index = BloomFilter.bitArrayToInt32(chunk);
    //       //console.log(index);
    //       countBits++;
    //       let mask = bigInt(1).shiftLeft(index);
    //       //this.intRep = this.intRep.or(mask);

    //       //console.log("Whitelist ", this.intRep.toString(2));
    //       //console.log("Mask      ", mask.toString(2));
    //       if (!this.intRep.and(mask).isZero()) { // is set
    //         //console.log("matched");
    //         countSetBits++;
    //       }
    //       else {
    //         //return false;
    //       }
    //     }
    //     cur >>= 1;  // Move to next bit in array
    //   }
    // }
    //console.log("countsetbits", countSetBits);
    if (countSetBits != k) return false;
    return true;
  }

}

module.exports = BloomFilter;