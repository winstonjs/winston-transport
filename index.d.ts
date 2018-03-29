// Type definitions for winston-transport 3.0
// Project: https://github.com/winstonjs/winston-transport
// Definitions by: DABH <https://github.com/DABH>
// Definitions: https://github.com/winstonjs/winston-transport

/// <reference types="node" />

import * as stream from 'stream';
import * as logform from 'logform';

interface TransportStreamOptions {
  level?: string;
  format?: logform.Format;
  handleExceptions?: boolean;
  log?: (info: any, next: () => void) => any;
  logv?: (info: any, next: () => void) => any;
  close?: () => void;
}

declare class TransportStream extends stream.Writable {
  format?: logform.Format;
  level?: string;
  handleExceptions?: boolean;
  log?: (info: any, next: () => void) => any;
  logv?: (info: any, next: () => void) => any;
  close?: () => void;

  constructor(opts: TransportStreamOptions);
  constructor();

}
