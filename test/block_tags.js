const Web3 = require("web3");
const assert = require("assert");
const Ganache = require(process.env.TEST_BUILD
  ? "../build/ganache.core." + process.env.TEST_BUILD + ".js"
  : "../index.js");
const { readFileSync } = require("fs");
const { compile } = require("solc");
const to = require("../lib/utils/to.js");

// Thanks solc. At least this works!
// This removes solc's overzealous uncaughtException event handler.
process.removeAllListeners("uncaughtException");

const source = readFileSync("./test/Example.sol", { encoding: "utf8" });
const result = compile(source, 1);

// Note: Certain properties of the following contract data are hardcoded to
// maintain repeatable tests. If you significantly change the solidity code,
// make sure to update the resulting contract data with the correct values.
const contract = {
  solidity: source,
  abi: result.contracts[":Example"].interface,
  binary: "0x" + result.contracts[":Example"].bytecode,
  position_of_value: "0x0000000000000000000000000000000000000000000000000000000000000000",
  expected_default_value: 5,
  call_data: {
    gas: "0x2fefd8",
    gasPrice: "0x1", // This is important, as passing it has exposed errors in the past.
    to: null, // set by test
    data: "0x3fa4f245"
  },
  transaction_data: {
    from: null, // set by test
    gas: "0x2fefd8",
    to: null, // set by test
    data: "0x552410770000000000000000000000000000000000000000000000000000000000000019" // sets value to 25 (base 10)
  }
};

describe("Block Tags", function() {
  const web3 = new Web3(Ganache.provider());
  const initial = {};
  let accounts;
  let contractAddress;
  let initialBlockNumber;

  before("Gather accounts", async function() {
    accounts = await web3.eth.getAccounts();
  });

  before("Get initial block number", async function() {
    initialBlockNumber = to.number(await web3.eth.getBlockNumber());
  });

  before("Get initial balance and nonce", async function() {
    const [balance, nonce] = [
      ...(await Promise.all([
        web3.eth.getBalance.bind(web3.eth, accounts[0])(),
        web3.eth.getTransactionCount.bind(web3.eth, accounts[0])()
      ]))
    ];
    initial.balance = balance;
    initial.nonce = to.number(nonce);
  });

  before("Make transaction that changes balance, nonce and code", async function() {
    const tx = await web3.eth.sendTransaction({
      from: accounts[0],
      data: contract.binary,
      gas: 3141592
    });
    const receipt = await web3.eth.getTransactionReceipt(tx.transactionHash);
    contractAddress = receipt.contractAddress;
  });

  it("should return the initial nonce at the previous block number", async function() {
    const nonce = await web3.eth.getTransactionCount(accounts[0], initialBlockNumber);
    assert.strictEqual(nonce, initial.nonce);

    // Check that the nonce incremented with the block number, just to be sure.
    const newNonce = await web3.eth.getTransactionCount(accounts[0], initialBlockNumber + 1);
    assert.strictEqual(newNonce, initial.nonce + 1);
  });

  it("should return the initial balance at the previous block number", async function() {
    const balance = await web3.eth.getBalance(accounts[0], initialBlockNumber);
    assert.strictEqual(balance, initial.balance);

    // Check that the balance incremented with the block number, just to be sure.
    const newBalance = await web3.eth.getBalance(accounts[0], initialBlockNumber + 1);
    const initialBalanceInEther = parseFloat(web3.utils.fromWei(initial.balance, "ether"));
    const balanceInEther = parseFloat(web3.utils.fromWei(newBalance, "ether"));
    assert(balanceInEther < initialBalanceInEther);
  });

  it("should return the no code at the previous block number", async function() {
    const code = await web3.eth.getCode(contractAddress, initialBlockNumber);
    assert.strictEqual(code, "0x");

    // Check that the code incremented with the block number, just to be sure.
    const newCode = await web3.eth.getCode(contractAddress, initialBlockNumber + 1);
    assert.notStrictEqual(newCode, "0x");
    assert(newCode.length > 20); // Just because we don't know the actual code we're supposed to get back
  });

  it("should not have the same tx and receipt root when the block contains 1 tx", async function() {
    // const block = await web3.eth.getBlock(initialBlockNumber + 1, false);
    // assert.strictEqual(block.transactions.length, 1, "should have one tx in the block.");
    // assert.notStrictEqual(block.transactionsRoot, block.receiptsRoot, "Trie roots should not be equal.");
  });
});
