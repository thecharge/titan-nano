export interface Embedder {
  readonly name: string;
  ready?(): Promise<boolean>;
  embed(text: string): Promise<number[]>;
}

export type EmbedderExtract = (text: string, model: string) => Promise<ArrayLike<number>>;
