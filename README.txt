[+] Install redis-server
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install redis-server
Edit .conf file: bind IP, comment protected mode

[+] Install nodejs ubuntu:
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs
Install dependencies:
npm init
npm install

[+] Deploy contract on Ropsten:
1. Update truffle-config.js
2. truffle deploy --network Ropsten

Current contract address on ropsten: 0x5C4e471d9c2ac9736C4b00E5E3072e5f02919853


