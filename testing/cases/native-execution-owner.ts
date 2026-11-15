import { NativeOwnerFixture, NativeToolRole } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeExecutionOwnerCases = {
  positive: [
    positive(
      "worker closes its registration and restores capacity",
      [NativeToolRole.Worker, NativeOwnerFixture.Ready],
      true,
    ),
    positive(
      "checker receives a separate guarded lease",
      [NativeToolRole.Checker, NativeOwnerFixture.Ready],
      true,
    ),
  ],
  negative: [
    rejected(
      "structured values cannot retain the minted credential",
      [NativeToolRole.Worker, NativeOwnerFixture.Value],
      true,
    ),
    rejected(
      "file chunks cannot split a minted credential past the scanner",
      [NativeToolRole.Checker, NativeOwnerFixture.Chunks],
      true,
    ),
    rejected(
      "invalid run directory consumes no registry capacity",
      [NativeToolRole.Worker, NativeOwnerFixture.Directory],
      true,
    ),
    rejected(
      "obsolete execution refuses native requests before closure",
      [NativeToolRole.Checker, NativeOwnerFixture.Obsolete],
      true,
    ),
  ],
};
