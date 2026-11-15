export interface NativeToolBridge {
  closed: Promise<void>;
  close(): Promise<void>;
}
