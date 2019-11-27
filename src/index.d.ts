import {
  Component,
  ComponentClass,
  ComponentState,
  FunctionComponent,
} from "react";

////////////////////////
// PromiseState
////////////////////////

// Similar to PromiseLike<T>
export type PromiseStateLike<T> = T | PromiseState<T>;

export interface PromiseStateStatic {
  create<T = {}>(meta?: any): PendingPromiseState<T>;
  refresh<T = {}>(previous: undefined, meta?: any): PendingPromiseState<T>;
  refresh<T = {}, P extends PromiseState<T> = PromiseState<T>>(previous: P, meta?: any): P;
  resolve<T = {}>(value?: PromiseStateLike<T>, meta?: any): FulfilledPromiseState<T>;
  reject<T = {}>(reason?: any, meta?: any): RejectedPromiseState<T>;
  all<T = {}>(iterable: Iterable<PromiseState<any>>): PromiseState<T[]>;
  race<T = {}>(iterable: Iterable<PromiseState<any>>): PromiseState<T>;
}

interface PromiseStateBase<T = {}> {
  readonly pending: boolean;
  readonly refreshing: boolean;
  readonly fulfilled: boolean;
  readonly rejected: boolean;
  readonly settled: boolean;
  readonly meta: any;
  then: <TFulfilled = T, TRejected = T>(
    onFulfilled?: (
      value: PromiseStateLike<T>,
    ) => PromiseStateLike<TFulfilled>,
    onRejected?: (reason: any) => PromiseStateLike<TRejected>,
  ) =>
    | PromiseStateLike<T>
    | PromiseStateLike<TFulfilled>
    | PromiseStateLike<TRejected>;
  catch: <TRejected = T>(
    onRejected?: (reason: any) => PromiseStateLike<TRejected>,
  ) => PromiseStateLike<T> | PromiseStateLike<TRejected>;
}

export interface PendingPromiseState<T = {}> extends PromiseStateBase {
  readonly pending: true;
  readonly fulfilled: false;
  readonly rejected: false;
}

export interface FulfilledPromiseState<T = {}> extends PromiseStateBase {
  readonly pending: false;
  readonly fulfilled: true;
  readonly rejected: false;
  readonly value: T;
}

export interface RejectedPromiseState<T = {}> extends PromiseStateBase {
  readonly pending: false;
  readonly fulfilled: false;
  readonly rejected: true;
  readonly reason: any;
}

export type PromiseState<T = {}> = PendingPromiseState<T> | FulfilledPromiseState<T> | RejectedPromiseState<T>;

export const PromiseState: Readonly<PromiseStateStatic>;

////////////////////////
// connect
////////////////////////

interface RequestType {
  prototype: Request;
  new (input: RequestInfo, init?: RequestInit): Request;
}

export interface Connect {
  <FetchProps, CompProps>(map: MapPropsToRequestsToProps<FetchProps, CompProps>): (
    component: ComponentClass<CompProps> | FunctionComponent<CompProps>,
  ) => ComponentClass<Omit<CompProps, keyof FetchProps>> & WithRefetch<Omit<CompProps, keyof FetchProps>>;
  defaults: <TProps = {}, T = {}>(newDefaults: Mapping<TProps, T>) => Connect;
  options: (newOptions: ConnectOptions) => Connect;
}

export interface ConnectOptions {
  withRef?: boolean;
}

export type MapPropsToRequestsToProps<FProps, CProps> = (
    props: Omit<CProps, keyof FProps>
) => PropsMap<FProps>;

// String or PromiseState
type PromiseStateMapping<FProps> = string | Mapping<FProps, any>;

// Function
type FunctionMapping<FProps, FProp extends keyof FProps> = FProps[FProp] extends ((...args: infer FArgs) => void)
    ? ((...args: FArgs) => PropsMapInner<FProps>)
    : never;

export type PropsMap<TProps> = {
    [TProp in keyof TProps]: PromiseStateMapping<TProps> | FunctionMapping<TProps, TProp>;
};

type PropsMapInner<TProps> = {
    [TProp in keyof TProps]?: PromiseStateMapping<TProps> | FunctionMapping<TProps, TProp>;
};

export interface Mapping<TProps, TValue> {
  buildRequest?: (mapping: Mapping<TProps, TValue>) => any;
  fetch?: (request: any) => any;
  handleResponse?: (response: any) => Promise<TValue>;
  Request?: RequestType;

  url?: string;
  method?: string;
  headers?: { [key: string]: string | (() => string) };
  credentials?: "omit" | "same-origin" | "include";
  body?: string;
  redirect?: "follow" | "error" | "manual";
  mode?: "cors" | "no-cors" | "same-origin" | "navigate";
  refreshInterval?: number;
  refreshing?: boolean | ((value: TValue) => TValue);
  force?: boolean;
  comparison?: any;

  then?: <TReturned>(
    value: TValue,
    meta: any,
  ) => Mapping<TProps, TReturned> | void;
  catch?: <TReturned>(reason: any) => Mapping<TProps, TReturned> | void;

  andThen?: (value: TValue) => PropsMap<TProps>;
  andCatch?: (rason: any) => PropsMap<TProps>;

  value?: TValue | PromiseLike<TValue> | (() => PromiseLike<TValue>);
  meta?: any;

  // Everything else is passed through unmodified
  [key: string]: any;
  [key: number]: any;
}

export interface WithRefetch<TProps> {
  WrappedComponent: ComponentClass<TProps>;
  new (props: TProps): Component<TProps, ComponentState> &
    WithRefetchInstance<TProps>;
}

export interface WithRefetchInstance<TProps> {
  getWrappedInstance(): Component<TProps>;
}

export const connect: Connect;
