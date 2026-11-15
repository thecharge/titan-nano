export type AsyncTask<T> = () => Promise<T>;

export type AsyncResults<T extends readonly AsyncTask<unknown>[]> = {
  -readonly [K in keyof T]: Awaited<ReturnType<T[K]>>;
};
