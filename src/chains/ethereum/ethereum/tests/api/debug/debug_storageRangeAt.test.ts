import assert from "assert";
import EthereumProvider from "../../../src/provider";
import getProvider from "../../helpers/getProvider";
import compile from "../../helpers/compile";
import path from "path";

describe("api", () => {
  describe("debug", () => {
    describe("storageRangeAt", () => {
      let provider: EthereumProvider;
      let accounts: string[];
      let contractAddress: string;
      let blockHash: string | Buffer;
      let deploymentBlockHash: string | Buffer;

      before(async () => {
        provider = await getProvider();
        accounts = await provider.send("eth_accounts");
        const contract = compile(
          path.join(__dirname, "..", "..", "contracts", "DebugStorage.sol")
        );

        const subscriptionId = await provider.send("eth_subscribe", [
          "newHeads"
        ]);

        const deploymentHash = await provider.send("eth_sendTransaction", [
          { from: accounts[0], data: contract.code, gas: 3141592 }
        ]);
        await provider.once("message");

        const deploymentTxReceipt = await provider.send(
          "eth_getTransactionReceipt",
          [deploymentHash]
        );
        contractAddress = deploymentTxReceipt.contractAddress;
        deploymentBlockHash = deploymentTxReceipt.blockHash;

        const methods = contract.contract.evm.methodIdentifiers;
        const initialValue =
          "0000000000000000000000000000000000000000000000000000000000000019";

        const transactionHash = await provider.send("eth_sendTransaction", [
          {
            from: accounts[0],
            to: contractAddress,
            gas: 3141592,
            data: `0x${methods["setValue(uint256)"]}${initialValue}`
          }
        ]);
        await provider.once("message");

        const txReceipt = await provider.send("eth_getTransactionReceipt", [
          transactionHash
        ]);
        blockHash = txReceipt.blockHash;

        await provider.send("eth_unsubscribe", [subscriptionId]);
      });

      after(async () => {
        provider && (await provider.disconnect());
      });

      it("should return the storage for the given range", async () => {
        const result = await provider.send("debug_storageRangeAt", [
          blockHash,
          0,
          contractAddress,
          "0x00",
          2
        ]);

        const storage = {
          "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
            value:
              "0x0000000000000000000000000000000000000000000000000000000000000005"
          },
          "0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000002",
            value:
              "0x68656c6c6f207270647200000000000000000000000000000000000000000014"
          }
        };

        assert.deepStrictEqual(result.storage, storage);

        assert.strictEqual(
          result.nextKey,
          "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6"
        );
      });

      it("should return only the filled storage slots", async () => {
        const result = await provider.send("debug_storageRangeAt", [
          blockHash,
          0,
          contractAddress,
          "0x00",
          4 // give me 4 entries
        ]);

        // although we asked for a total number of 4 entries, we only have 3
        // and should return the 3 we have
        const storage = {
          "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
            value:
              "0x0000000000000000000000000000000000000000000000000000000000000005"
          },
          "0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000002",
            value:
              "0x68656c6c6f207270647200000000000000000000000000000000000000000014"
          },
          "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000001",
            value:
              "0x0000000000000000000000000000000000000000000000000000000000000001"
          }
        };
        assert.deepStrictEqual(result.storage, storage);

        assert.strictEqual(result.nextKey, null);
      });

      it("should return empty storage when debugging a deployment transaction", async () => {
        const result = await provider.send("debug_storageRangeAt", [
          deploymentBlockHash,
          0,
          contractAddress,
          "0x00",
          2
        ]);

        assert.deepStrictEqual(result.storage, {});

        assert.strictEqual(result.nextKey, null);
      });

      it("should accept a nextKey as the startKey for the given range", async () => {
        const result = await provider.send("debug_storageRangeAt", [
          blockHash,
          0,
          contractAddress,
          "0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace",
          2
        ]);

        const storage = {
          "0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000002",
            value:
              "0x68656c6c6f207270647200000000000000000000000000000000000000000014"
          },
          "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000001",
            value:
              "0x0000000000000000000000000000000000000000000000000000000000000001"
          }
        };

        assert.deepStrictEqual(result.storage, storage);
        assert.strictEqual(result.nextKey, null);
      });

      it("should accept a nextKey as the startKey for the given range AND provide correct nextKey", async () => {
        const result = await provider.send("debug_storageRangeAt", [
          blockHash,
          0,
          contractAddress,
          "0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace",
          1
        ]);

        const storage = {
          "0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000002",
            value:
              "0x68656c6c6f207270647200000000000000000000000000000000000000000014"
          }
        };

        assert.deepStrictEqual(result.storage, storage);
        assert.strictEqual(
          result.nextKey,
          "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6"
        );
      });

      it("should return correct storage given an arbitrary hexadecimal value for startKey", async () => {
        const result = await provider.send("debug_storageRangeAt", [
          blockHash,
          0,
          contractAddress,
          "0x290f",
          3
        ]);

        const storage = {
          "0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000002",
            value:
              "0x68656c6c6f207270647200000000000000000000000000000000000000000014"
          },
          "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000001",
            value:
              "0x0000000000000000000000000000000000000000000000000000000000000001"
          }
        };
        assert.deepStrictEqual(result.storage, storage);
        assert.strictEqual(result.nextKey, null);
      });

      it("should return correct storage given a different arbitrary hexadecimal value for startKey", async () => {
        const result = await provider.send("debug_storageRangeAt", [
          blockHash,
          0,
          contractAddress,
          "0x290c",
          3
        ]);

        const storage = {
          "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
            value:
              "0x0000000000000000000000000000000000000000000000000000000000000005"
          },
          "0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000002",
            value:
              "0x68656c6c6f207270647200000000000000000000000000000000000000000014"
          },
          "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6": {
            key:
              "0x0000000000000000000000000000000000000000000000000000000000000001",
            value:
              "0x0000000000000000000000000000000000000000000000000000000000000001"
          }
        };

        assert.deepStrictEqual(result.storage, storage);
        assert.strictEqual(result.nextKey, null);
      });
    });
  });
});