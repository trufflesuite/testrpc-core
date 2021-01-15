import { Base, CliTypeMap, CliTypes } from "./base";
import { ExclusiveGroupUnionAndUnconstrainedPlus } from "./exclusive";
import {
  Legacy,
  OptionCliType,
  OptionHasCliType,
  OptionHasDefault,
  OptionHasLegacy,
  OptionName,
  OptionRawType,
  OptionType
} from "./getters";
import { UnionToIntersection } from "./types";

//#region Definition helpers
type Normalize<
  C extends Base.Config,
  N extends OptionName<C> = OptionName<C>
> = (rawInput: OptionRawType<C, N>) => OptionType<C, N>;

export type ExternalConfig<C extends Base.Config> = Partial<
  ExclusiveGroupUnionAndUnconstrainedPlus<C, "rawType">
>;

export type InternalConfig<
  C extends Base.Config
> = ExclusiveGroupUnionAndUnconstrainedPlus<C, "type">;

export type Definitions<C extends Base.Config> = {
  [N in OptionName<C>]: {
    readonly normalize: Normalize<C, N>;
    readonly cliDescription: string;
    readonly disableInCLI?: boolean;
    readonly cliAliases?: string[];
    readonly cliChoices?: string[] | number[];
  } & (void extends OptionHasCliType<C, N>
    ? {
        readonly cliType?: CliTypeMap<CliTypes>;
      }
    : {
        readonly cliType: CliTypeMap<OptionCliType<C, N>>;
        readonly cliCoerce?: (
          rawType: OptionCliType<C, N>
        ) => OptionRawType<C, N>;
      }) &
    (void extends OptionHasDefault<C, N>
      ? {}
      : {
          readonly default: (config: InternalConfig<C>) => OptionType<C, N>;
          readonly defaultDescription?: string;
        }) &
    (void extends OptionHasLegacy<C, N>
      ? {}
      : {
          readonly legacyName: UnionToIntersection<keyof Legacy<C, N>>;
        });
};
//#endregion Definition helpers
