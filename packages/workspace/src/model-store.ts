import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CliOption,
  ErrorCode,
  ErrorField,
  FileEncoding,
  FileErrorCode,
  HashAlgorithm,
  LocalModel,
  LocalModelSource,
  PathPart,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { LocalModelMessage, modelArtifactFailure } from "@titan/messages";
import { atomicWriteStream, fileHandleChunks } from "@titan/streams";
import {
  type LocalModelArtifact,
  type LocalModelFetch,
  type LocalModelManifest,
  LocalModelManifestSchema,
  type LocalModelStatus,
} from "@titan/types";

export class LocalModelStore {
  private source: LocalModelManifest;
  readonly directory: string;
  readonly revision: string;

  constructor(
    private home: string,
    source: LocalModelManifest = LocalModelSource,
    private fetcher: LocalModelFetch = fetch,
  ) {
    this.source = LocalModelManifestSchema.parse(source);
    this.revision = this.source.revision;
    this.directory = resolve(home, LocalModel.Folder, this.source.folder, this.source.revision);
  }

  private async directories(artifact: LocalModelArtifact, create: boolean): Promise<void> {
    if (create) await mkdir(this.home, { recursive: true, mode: LocalModel.DirectoryMode });
    let path = this.home;
    const components = [
      LocalModel.Folder,
      this.source.folder,
      this.source.revision,
      ...artifact.file.split(PathPart.Separator).slice(0, -1),
    ];
    for (const component of components) {
      path = resolve(path, component);
      if (create) await mkdir(path, { recursive: true, mode: LocalModel.DirectoryMode });
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink() || !metadata.isDirectory())
        throw new TitanError(ErrorCode.NotBuilt, LocalModelMessage.UnsafeCache);
    }
  }

  private async valid(artifact: LocalModelArtifact): Promise<boolean> {
    const path = resolve(this.directory, artifact.file);
    try {
      await this.directories(artifact, false);
      const metadata = await lstat(path);
      if (!metadata.isFile())
        throw new TitanError(ErrorCode.NotBuilt, LocalModelMessage.UnsafeCache);
      if (metadata.size !== artifact.bytes) return false;
      const file = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const digest = createHash(HashAlgorithm.Sha256);
        let size = 0;
        for await (const chunk of fileHandleChunks(file)) {
          size += chunk.length;
          if (size > artifact.bytes) return false;
          digest.update(chunk);
        }
        return size === artifact.bytes && digest.digest(FileEncoding.Hex) === artifact.sha256;
      } finally {
        await file.close();
      }
    } catch (error) {
      if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
        return false;
      throw error;
    }
  }

  async inspect(): Promise<LocalModelStatus> {
    const missing: string[] = [];
    for (const artifact of this.source.artifacts)
      if (!(await this.valid(artifact))) missing.push(artifact.file);
    return {
      name: this.source.name,
      revision: this.source.revision,
      directory: this.directory,
      bytes: this.source.artifacts.reduce((total, artifact) => total + artifact.bytes, 0),
      ready: missing.length === 0,
      missing,
      fetch_command: [
        LocalModel.Command,
        LocalModel.Doctor,
        `${LocalModel.OptionPrefix}${CliOption.Home}`,
        this.home,
        `${LocalModel.OptionPrefix}${CliOption.FetchModel}`,
      ],
    };
  }

  private async *contents(
    response: Response,
    artifact: LocalModelArtifact,
  ): AsyncGenerator<Uint8Array> {
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new TitanError(ErrorCode.NotBuilt, LocalModelMessage.FetchFailed);
    }
    const digest = createHash(HashAlgorithm.Sha256);
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > artifact.bytes)
        throw new TitanError(ErrorCode.NotBuilt, modelArtifactFailure(artifact.file));
      digest.update(chunk);
      yield chunk;
    }
    if (size !== artifact.bytes || digest.digest(FileEncoding.Hex) !== artifact.sha256)
      throw new TitanError(ErrorCode.NotBuilt, modelArtifactFailure(artifact.file));
  }

  async fetch(): Promise<LocalModelStatus> {
    for (const artifact of this.source.artifacts) {
      if (await this.valid(artifact)) continue;
      await this.directories(artifact, true);
      const response = await this.fetcher(
        [this.source.base, this.source.revision, artifact.file].join(PathPart.Separator),
        { signal: AbortSignal.timeout(LocalModel.FetchTimeoutMilliseconds) },
      );
      await atomicWriteStream(
        resolve(this.directory, artifact.file),
        this.contents(response, artifact),
        artifact.bytes,
      );
    }
    return this.inspect();
  }
}
