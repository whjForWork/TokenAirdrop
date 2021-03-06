/**
 * Created by zhaoyiyu on 2018/1/17.
 */

const Config = require('./../config/config.js');

Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(Config.transaction.url));

//init
const Tx = require('ethereumjs-tx');
const ethjsaccount = require('ethjs-account');
const fs = require('fs');
const solc = require('solc');

// compile the code
const input = fs.readFileSync('./contract/airdrop.sol');
const output = solc.compile(input.toString());
const abi = JSON.parse(output.contracts[':TokenAirDrop'].interface);


const tokenInput = fs.readFileSync('./contract/erc20Token.sol');
const tokenOutput = solc.compile(tokenInput.toString());
const tokenAbi = JSON.parse(tokenOutput.contracts[':TokenERC20'].interface);
//------------------------------ init property ----------------------------

//airdrop contract address
const airContractAddress = Config.airdropModule.airdropContractAddress;
//user privateKey
const userPrivateKey = Config.airdropModule.userPrivateKey;
//erc20 token contract address
const tokenContractAddress = Config.airdropModule.tokenContractAddress;
//transfer from address
const transferFromAddress = Config.airdropModule.transferFromAddress;

//-------------------------------- contract --------------------------------

var airdropContract = new web3.eth.Contract(abi, airContractAddress);

var tokenContract = new web3.eth.Contract(tokenAbi, tokenContractAddress);


// tokenContract.methods.name().call().then(console.log);
//
// tokenContract.methods.balanceOf('0x585a40461FF12C6734E8549A7FB527120D4b8d0D').call(null,function(error,result){
//     console.log("balance ->"+result);
// });

//-------------------------------- event --------------------------------

tokenContract.events.Transfer({
    fromBlock: 0,
    toBlock:'latest'
}, function(error, event){ console.log("result:\n"+JSON.stringify(event)); })
    .on('data', function(event){
        console.log(event); // same results as the optional callback above
    })
    .on('changed', function(event){
        // remove event from local database
    })
    .on('error', console.error);

//-------------------------------- function --------------------------------

var transfer = function(erc20TokenContractAddress , airDropOriginalAddress ,airdropDestinationAddresses, airdropAmounts,userPrivateKey,hashIdCallBack,success, error) {

    var fromAddress = privateKeyToAddress(userPrivateKey);

    //transaction config
    var t = {
        to: airContractAddress,
        value: '0x00',
        data: airdropContract.methods.airDrop(erc20TokenContractAddress,
            airDropOriginalAddress,
            airdropDestinationAddresses,
            airdropAmounts).encodeABI()
    };
    //get current gasPrice, you can use default gasPrice or custom gasPrice!
    web3.eth.getGasPrice().then(function(p) {
        //t.gasPrice = web3.utils.toHex(p);
        t.gasPrice = web3.utils.toHex(Config.transaction.gasPrice);
        //get nonce value
        web3.eth.getTransactionCount(fromAddress,
            function(err, r) {
                t.nonce = web3.utils.toHex(r);
                t.from = fromAddress;
                //get gasLimit value , you can use estimateGas or custom gasLimit!
                web3.eth.estimateGas(t,
                    function(err, gas) {
                        t.gasLimit = web3.utils.toHex(Config.transaction.gasLimit);
                        var tx = new Tx(t);
                        var privateKey = new Buffer(userPrivateKey, 'hex');

                        //sign
                        tx.sign(privateKey);
                        var serializedTx = '0x' + tx.serialize().toString('hex');
                        // console.log("serializedTx----"+serializedTx);

                        console.log("send signed transaction");

                        //sendSignedTransaction
                        web3.eth.sendSignedTransaction(serializedTx).on('transactionHash',function(hash){
                            console.log('hashId:'+ hash+'\n');
                            hashIdCallBack(hash);
                        }).on('receipt',function(receipt){
                            //console.log('receipt:'+ JSON.stringify(receipt));
                            var s = receipt.status;
                            console.log("resultStatus:"+s);
                            if(s == 1){
                                success(JSON.stringify(receipt));
                            }
                            else {
                                error(JSON.stringify(receipt));
                            }
                        }).on('confirmation',function(confirmationNumber, receipt){

                            /*web3.eth.getBlockNumber(function (number) {
                                console.log("number--"+number+"\n");
                            });*/
                          //  console.log('entrance'+ JSON.stringify(confirmationNumber)+'--------------'+ JSON.stringify(receipt));
                        }).on('error',function(error){
                            console.log('Failure to send a signature transaction：'+error);
                        });
                    });
            });
        return this
    })
};


var privateKeyToAddress = function(privateKey) {

    var address = ethjsaccount.privateToAccount(privateKey).address;
    return address;
};


var totalAirdropAdress = [];
var totalAmounts = [];

var transferWithAddressAndAmounts = function(addresses,amounts) {

    for (var i in amounts){

        var amount = amounts[i].toString();
        var obj = web3.utils.toWei(amount, 'ether');
        totalAmounts.push(obj);
    }

    totalAirdropAdress = addresses;

    startHandleAirdrop(0);
};


var listen = require('./listen');
const onceAmountOfAirdropList = 200;

function startHandleAirdrop(index) {

    console.log('\n');


    var currentAddresses = [];
    var currentAmounts = [];

    var didSendLastAirdropList = false;

    for(i = index * onceAmountOfAirdropList ; i < (index +1) * onceAmountOfAirdropList ; i ++ ){

        var address = totalAirdropAdress[i];
        var amount = totalAmounts[i];

        currentAddresses.push(address);
        currentAmounts.push(amount);

        //判断是否为最后一部分
        if (i == totalAirdropAdress.length - 1){
            didSendLastAirdropList = true;
            break;
        }
    }

    console.log(currentAddresses +'\n'+currentAmounts);

    transfer(tokenContractAddress,transferFromAddress,currentAddresses,currentAmounts,userPrivateKey,function (hashId) {

        listen.startListenAirdropResult(hashId,function (result) {

            console.log('\n\n第'+(index+1)+'波已发送完毕\n');

            //判断是否已经发送完最后一批
            if(didSendLastAirdropList){
                console.log("\n全部发送完毕!!!\n\n");
                listen.stopListen();
            }
            else {
                startHandleAirdrop(index+1);
            }
        });
    },function (success) {

        console.log("success:"+success);
    },function (error) {

        console.log("error:"+error);
    });
}

module.exports = {
    transferTool:transferWithAddressAndAmounts
};
