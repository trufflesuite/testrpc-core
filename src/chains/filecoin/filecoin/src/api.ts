//#region Imports
import { types, Quantity, PromiEvent } from "@ganache/utils";
import Blockchain from "./blockchain";
import {
  StartDealParams,
  SerializedStartDealParams
} from "./things/start-deal-params";
import { SerializedRootCID, RootCID } from "./things/root-cid";
import { SerializedDealInfo } from "./things/deal-info";
import { SerializedTipset, Tipset } from "./things/tipset";
import { SerializedAddress } from "./things/address";
import {
  SerializedRetrievalOrder,
  RetrievalOrder
} from "./things/retrieval-order";
import { SerializedQueryOffer } from "./things/query-offer";
import Emittery from "emittery";
import { HeadChange, HeadChangeType } from "./things/head-change";
import { SubscriptionMethod, SubscriptionId } from "./types/subscriptions";
import { FileRef, SerializedFileRef } from "./things/file-ref";
import { MinerPower, SerializedMinerPower } from "./things/miner-power";
import { PowerClaim } from "./things/power-claim";
import { SerializedVersion, Version } from "./things/version";
import { MinerInfo, SerializedMinerInfo } from "./things/miner-info";

export default class FilecoinApi implements types.Api {
  readonly [index: string]: (...args: any) => Promise<any>;

  readonly #getId = (id => () => Quantity.from(++id))(0);
  readonly #subscriptions = new Map<string, Emittery.UnsubscribeFn>();
  readonly #blockchain: Blockchain;

  constructor(blockchain: Blockchain) {
    this.#blockchain = blockchain;
  }

  async stop(): Promise<void> {
    return await this.#blockchain.stop();
  }

  async "Filecoin.Version"(): Promise<SerializedVersion> {
    return new Version({
      blockDelay: BigInt(this.#blockchain.options.miner.blockTime)
    }).serialize();
  }

  async "Filecoin.ActorAddress"(): Promise<string> {
    // this is the StorageMiner API Actor Address, which is the miner
    return this.#blockchain.miner;
  }

  async "Filecoin.ChainGetGenesis"(): Promise<SerializedTipset> {
    return this.#blockchain.latestTipset().serialize();
  }

  async "Filecoin.ChainHead"(): Promise<SerializedTipset> {
    return this.#blockchain.latestTipset().serialize();
  }

  "Filecoin.ChainNotify"(): PromiEvent<Quantity> {
    const subscription = this.#getId();
    const promiEvent = PromiEvent.resolve(subscription);

    const currentHead = new HeadChange({
      type: HeadChangeType.HCCurrent,
      val: this.#blockchain.latestTipset()
    });

    const unsubscribe = this.#blockchain.on("tipset", (tipset: Tipset) => {
      const newHead = new HeadChange({
        type: HeadChangeType.HCApply,
        val: tipset
      });

      promiEvent.emit("message", {
        type: SubscriptionMethod.ChannelUpdated,
        data: [subscription.toString(), [newHead.serialize()]]
      });
    });

    // There currently isn't an unsubscribe method,
    // but it would go here
    this.#subscriptions.set(subscription.toString(), unsubscribe);

    promiEvent.emit("message", {
      type: SubscriptionMethod.ChannelUpdated,
      data: [subscription.toString(), [currentHead.serialize()]]
    });

    return promiEvent;
  }

  [SubscriptionMethod.ChannelClosed](
    subscriptionId: SubscriptionId
  ): Promise<boolean> {
    const subscriptions = this.#subscriptions;
    const unsubscribe = subscriptions.get(subscriptionId);

    if (unsubscribe) {
      subscriptions.delete(subscriptionId);
      unsubscribe();
      return Promise.resolve(true);
    } else {
      return Promise.resolve(false);
    }
  }

  async "Filecoin.StateListMiners"(): Promise<Array<string>> {
    return [this.#blockchain.miner];
  }

  async "Filecoin.StateMinerPower"(
    minerAddress: string
  ): Promise<SerializedMinerPower> {
    // I don't fully understand what these values are supposed to be/mean
    // but since we're the only miner on this "network", I figure they don't
    // super matter. I'm putting in these placeholder values for now
    if (minerAddress === this.#blockchain.miner) {
      const power = new MinerPower({
        minerPower: new PowerClaim({
          rawBytePower: 1n,
          qualityAdjPower: 1n
        }),
        totalPower: new PowerClaim({
          rawBytePower: 1n,
          qualityAdjPower: 1n
        }),
        hasMinPower: false
      });

      return power.serialize();
    } else {
      const power = new MinerPower({
        minerPower: new PowerClaim({
          rawBytePower: 0n,
          qualityAdjPower: 0n
        }),
        totalPower: new PowerClaim({
          rawBytePower: 0n,
          qualityAdjPower: 0n
        }),
        hasMinPower: false
      });

      return power.serialize();
    }
  }

  async "Filecoin.StateMinerInfo"(
    minerAddress: string
  ): Promise<SerializedMinerInfo> {
    // TODO: defaults are not really accurate here
    return new MinerInfo().serialize();
  }

  async "Filecoin.WalletDefaultAddress"(): Promise<SerializedAddress> {
    return this.#blockchain.address.serialize();
  }

  async "Filecoin.WalletBalance"(address: string): Promise<string> {
    let managedAddress = this.#blockchain.address;

    // For now, anything but our default address will have no balance
    if (managedAddress.value == address) {
      return this.#blockchain.balance.serialize();
    } else {
      return "0";
    }
  }

  async "Filecoin.ClientStartDeal"(
    serializedProposal: SerializedStartDealParams
  ): Promise<SerializedRootCID> {
    let proposal = new StartDealParams(serializedProposal);
    let proposalRootCid = await this.#blockchain.startDeal(proposal);

    return proposalRootCid.serialize();
  }

  async "Filecoin.ClientListDeals"(): Promise<Array<SerializedDealInfo>> {
    return this.#blockchain.deals.map(deal => deal.serialize());
  }

  async "Filecoin.ClientFindData"(
    rootCid: SerializedRootCID
  ): Promise<Array<SerializedQueryOffer>> {
    let remoteOffer = await this.#blockchain.createQueryOffer(
      new RootCID(rootCid)
    );
    return [remoteOffer.serialize()];
  }

  async "Filecoin.ClientHasLocal"(
    rootCid: SerializedRootCID
  ): Promise<boolean> {
    return await this.#blockchain.hasLocal(rootCid["/"]);
  }

  async "Filecoin.ClientRetrieve"(
    retrievalOrder: SerializedRetrievalOrder,
    ref: SerializedFileRef
  ): Promise<object> {
    await this.#blockchain.retrieve(
      new RetrievalOrder(retrievalOrder),
      new FileRef(ref)
    );

    // Return value is a placeholder.
    //
    // 1) JSON wants to parse the result, so this prevents it parsing `undefined`.
    // 2) This API is going to change very soon, according to Lotus devs.
    //
    // As of this writing, this API function is *supposed* to return nothing at all.
    return {};
  }

  async "Filecoin.GanacheMineTipset"(): Promise<SerializedTipset> {
    await this.#blockchain.mineTipset();
    return this.#blockchain.latestTipset().serialize();
  }
}
