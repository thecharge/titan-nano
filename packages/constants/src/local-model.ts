import { TextSymbol } from "./config.ts";
import { EmbedderName } from "./embedder.ts";

export const LocalModel = {
  Folder: "models",
  StatusField: "model",
  TestHome: "node_modules/.bun/titan-model",
  OptionPrefix: "--",
  Command: "titan",
  Doctor: "doctor",
  Dtype: "q8",
  Https: "https://",
  MaximumName: 128,
  MaximumBytes: 64 * 1024 * 1024,
  MaximumArtifacts: 16,
  MaximumCommandArguments: 8,
  DirectoryMode: 0o700,
  FetchTimeoutMilliseconds: 120000,
} as const;

export const LocalModelArtifactPattern = /^(?:onnx\/)?[A-Za-z0-9_-]+\.(?:json|txt|onnx)$/;
export const LocalModelFolderPattern = /^[A-Za-z0-9_-]+$/;
export const LocalModelRevisionPattern = /^[a-f0-9]{40}$/;

export const LocalModelSource = {
  name: "Xenova/all-MiniLM-L6-v2",
  folder: "all-MiniLM-L6-v2",
  revision: "751bff37182d3f1213fa05d7196b954e230abad9",
  base: "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve",
  artifacts: [
    {
      file: "config.json",
      bytes: 650,
      sha256: "7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7",
    },
    {
      file: "tokenizer.json",
      bytes: 711661,
      sha256: "da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0",
    },
    {
      file: "tokenizer_config.json",
      bytes: 366,
      sha256: "9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3",
    },
    {
      file: "special_tokens_map.json",
      bytes: 125,
      sha256: "b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3",
    },
    {
      file: "vocab.txt",
      bytes: 231508,
      sha256: "07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3",
    },
    {
      file: "onnx/model_quantized.onnx",
      bytes: 22972370,
      sha256: "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1",
    },
  ],
} as const;

export const LocalModelEmbedderName = `${EmbedderName.Local}${TextSymbol.Colon}${LocalModelSource.revision}`;
