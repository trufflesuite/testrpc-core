import {ProviderOptions} from "@ganache/options";
import Emittery from "emittery";
import {types, utils} from "@ganache/utils";
import JsonRpc from "@ganache/utils/src/things/jsonrpc";
import FilecoinApi from "./api";
import FilecoinProvider from "./provider";
import PromiEvent from "@ganache/utils/src/things/promievent";
import {RecognizedString, WebSocket, HttpRequest} from "uWebSockets.js";

export default class FilecoinConnector extends Emittery.Typed<undefined, "ready" | "close"> 
  implements types.Connector<FilecoinApi, JsonRpc.Request<FilecoinApi>> {
 
  #provider: FilecoinProvider;

  get provider() {
    return this.#provider;
  }

  constructor(providerOptions: ProviderOptions = null, executor: utils.Executor) {
    super();

    const provider = this.#provider = new FilecoinProvider(providerOptions, executor);
    
    // tell the consumer (like a `ganache-core` server/connector) everything is ready
    this.emit("ready");
  }

  parse(message: Buffer): JsonRpc.Request<FilecoinApi> {
    throw new Error("Method not implemented.");
  }


  handle(payload: JsonRpc.Request<FilecoinApi>, connection: HttpRequest | WebSocket): PromiEvent<any> {
    const method = payload.method;
    
    return new PromiEvent((resolve) => {
      return this.#provider.request(method, payload.params as Parameters<FilecoinApi[typeof method]>).then(resolve);
    });
  }

  format(result: any, payload: JsonRpc.Request<FilecoinApi>): RecognizedString {
    const json = JsonRpc.Response(payload.id, result);
    return JSON.stringify(json);
  }

  close(){
    //return this.#provider.disconnect();
  }

}