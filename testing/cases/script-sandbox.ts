import { positive, rejected } from "@titan/test-factories";

export const scriptBoundaryCases = {
  positive: [
    positive(
      "reading a regular file as a link retains its invalid-argument error",
      [
        "bun -e \"const fs=require('node:fs');try{fs.readlinkSync('allowed.txt');process.exit(8)}catch(e){if(e.code!=='EINVAL')throw e}fs.writeFileSync('allowed.txt','Changed')\"",
        ["allowed.txt"],
        false,
      ],
      true,
    ),
    positive(
      "reading a directory as a link retains its invalid-argument error",
      [
        "bun -e \"const fs=require('node:fs');try{fs.readlinkSync('nested');process.exit(8)}catch(e){if(e.code!=='EINVAL')throw e}fs.writeFileSync('allowed.txt','Changed')\"",
        ["allowed.txt"],
        false,
      ],
      true,
    ),
    positive(
      "approved scripts retain loopback network access",
      [
        "bun -e \"const server=Bun.serve({port:0,fetch(){return new Response('ok')}});try{const response=await fetch('http://127.0.0.1:'+server.port);if(await response.text()!=='ok')process.exit(8);require('node:fs').writeFileSync('allowed.txt','Changed')}finally{server.stop(true)}\"",
        ["allowed.txt"],
        false,
      ],
      true,
    ),
    positive(
      "atomic rename preserves an existing destination when overwrite is refused",
      [
        'printf Changed > allowed.txt && printf Replacement > "$TMPDIR/output" && mv -n "$TMPDIR/output" allowed.txt && test -f "$TMPDIR/output"',
        ["allowed.txt"],
        false,
      ],
      true,
    ),
    positive(
      "declared file descriptors permit mode changes",
      [
        "bun -e \"const fs=require('node:fs');const fd=fs.openSync('allowed.txt','r');fs.fchmodSync(fd,0o600);fs.closeSync(fd);fs.writeFileSync('allowed.txt','Changed')\"",
        ["allowed.txt"],
        false,
      ],
      true,
    ),
    positive(
      "declared file descriptors permit timestamp changes",
      [
        "bun -e \"const fs=require('node:fs');const fd=fs.openSync('allowed.txt','r');fs.futimesSync(fd,1,1);fs.closeSync(fd);fs.writeFileSync('allowed.txt','Changed')\"",
        ["allowed.txt"],
        false,
      ],
      true,
    ),
    positive(
      "private temporary links support build tools",
      [
        'ln -s "$PWD/allowed.txt" "$TMPDIR/link" && test "$(cat "$TMPDIR/link")" = Original && printf Changed > allowed.txt',
        ["allowed.txt"],
        false,
      ],
      true,
    ),
    positive(
      "private temporary Git repositories support verification",
      [
        'git init -q "$TMPDIR/repository" && test -d "$TMPDIR/repository/.git"',
        ["missing.txt"],
        false,
      ],
      true,
    ),
    positive(
      "arbitrary Bun programs can update their declared file",
      [
        "bun -e \"require('node:fs').writeFileSync('allowed.txt','Changed')\"",
        ["allowed.txt"],
        false,
      ],
      true,
    ),
    positive(
      "script updates its declared live file",
      ["printf Changed > allowed.txt; test $(cat allowed.txt) = Changed", ["allowed.txt"], false],
      true,
    ),
    positive(
      "missing declared file stays absent until the command creates it",
      ["test ! -e missing.txt && printf Created > missing.txt", ["missing.txt"], false, "created"],
      true,
    ),
    positive(
      "script creates missing declared parents",
      [
        "mkdir -p generated/deep && printf Created > generated/deep/note.txt",
        ["generated/deep/note.txt"],
        false,
      ],
      true,
    ),
    positive(
      "script replaces its declared file through its private temporary directory",
      [
        'printf Changed > "$TMPDIR/output" && mv "$TMPDIR/output" allowed.txt && test $(cat allowed.txt) = Changed',
        ["allowed.txt"],
        false,
      ],
      true,
    ),
    positive(
      "root scope supports new directories on the shared tree",
      ["mkdir generated && printf Created > generated/note.txt", ["."], false],
      true,
    ),
    positive(
      "policy treats glob and environment characters literally",
      ["printf Created > 'literal[$]name'", ["literal[$]name"], false],
      true,
    ),
  ],
  negative: [
    rejected(
      "read-only outside descriptors cannot change file modes",
      [
        "bun -e \"const fs=require('node:fs');const fd=fs.openSync('../outside.txt','r');try{fs.fchmodSync(fd,0o777);process.exit(8)}catch(e){if(e.code!=='EACCES')throw e;process.exit(9)}\"",
        ["allowed.txt"],
        true,
      ],
      true,
    ),
    rejected(
      "read-only outside descriptors cannot change timestamps",
      [
        "bun -e \"const fs=require('node:fs');const fd=fs.openSync('../outside.txt','r');try{fs.futimesSync(fd,1,1);process.exit(8)}catch(e){if(e.code!=='EACCES')throw e;process.exit(9)}\"",
        ["allowed.txt"],
        true,
      ],
      true,
    ),
    rejected(
      "read-only file opens cannot truncate an outside file",
      [
        "bun -e \"const fs=require('node:fs');try{fs.closeSync(fs.openSync('../outside.txt',fs.constants.O_RDONLY|fs.constants.O_TRUNC));process.exit(8)}catch(e){if(e.code!=='EACCES')throw e;process.exit(9)}\"",
        ["allowed.txt"],
        true,
      ],
      true,
    ),
    rejected(
      "read-only file opens cannot create an undeclared file",
      [
        "bun -e \"const fs=require('node:fs');try{fs.closeSync(fs.openSync('unlisted.txt',fs.constants.O_RDONLY|fs.constants.O_CREAT));process.exit(8)}catch(e){if(e.code!=='EACCES')throw e;process.exit(9)}\"",
        ["allowed.txt"],
        true,
      ],
      true,
    ),
    rejected(
      "a private temporary symbolic link cannot expose an outside write",
      [
        'ln -s "$PWD/../outside.txt" "$TMPDIR/link" && printf Escaped > "$TMPDIR/link"',
        ["allowed.txt"],
        true,
      ],
      true,
    ),
    rejected(
      "a private temporary hard link cannot expose an outside write",
      [
        'ln ../outside.txt "$TMPDIR/link" && printf Escaped > "$TMPDIR/link"',
        ["allowed.txt"],
        true,
      ],
      true,
    ),
    rejected(
      "arbitrary Bun programs cannot change an unlisted sibling",
      [
        "bun -e \"try{require('node:fs').writeFileSync('../outside.txt','Escaped');process.exit(8)}catch(e){if(e.code!=='EACCES')throw e;process.exit(9)}\"",
        ["allowed.txt"],
        true,
      ],
      true,
    ),
    rejected(
      "script cannot write a sibling outside the project",
      ["printf Escaped > ../outside.txt", ["allowed.txt"], true],
      true,
    ),
    rejected(
      "script cannot create an undeclared file",
      ["printf Escaped > unlisted.txt", ["allowed.txt"], true],
      true,
    ),
    rejected(
      "script cannot chmod a sibling outside the project",
      ["chmod 777 ../outside.txt", ["allowed.txt"], true],
      true,
    ),
    rejected(
      "script cannot delete a sibling outside the project",
      ["rm ../outside.txt", ["allowed.txt"], true],
      true,
    ),
    rejected(
      "script cannot rename a sibling into its scope",
      ["mv ../outside.txt allowed.txt", ["allowed.txt"], true],
      true,
    ),
    rejected(
      "script cannot create a hard link from outside its scope",
      ["ln ../outside.txt allowed-link && printf Escaped > allowed-link", ["."], true],
      true,
    ),
    rejected(
      "script cannot change an existing external hard link",
      ["printf Escaped > hard", ["."], true],
      true,
    ),
    rejected(
      "script cannot follow an external symbolic link",
      ["printf Escaped > symbolic", ["."], true],
      true,
    ),
    rejected(
      "root script cannot change Git metadata",
      ["printf Escaped > .git/config", ["."], true],
      true,
    ),
    rejected(
      "root script cannot change nested Git metadata",
      ["printf Escaped > nested/.git/config", ["."], true],
      true,
    ),
    rejected(
      "root script cannot rename an ancestor of protected metadata",
      ["mv nested relocated", ["."], true],
      true,
    ),
    rejected(
      "root script cannot change daemon state",
      ["printf Escaped > runtime/state", ["."], true],
      true,
    ),
    rejected(
      "root script cannot create nested environment secrets",
      ["printf Escaped > nested/.env", ["."], true],
      true,
    ),
    rejected(
      "root script cannot create root environment secrets",
      ["printf Escaped > .env.test", ["."], true],
      true,
    ),
    rejected(
      "arbitrary descendants retain their parent's file boundary",
      ["/bin/sh -c 'printf Escaped > ../outside.txt'", ["allowed.txt"], true],
      true,
    ),
  ],
};

export const scriptPolicyCases = {
  positive: [
    positive(
      "macOS policy includes literal missing-file creation",
      ["darwin", ["missing.txt"]],
      true,
    ),
    positive(
      "macOS policy includes missing parent creation and protected descendants",
      ["darwin", ["generated/deep/note.txt"]],
      true,
    ),
  ],
  negative: [
    rejected(
      "unsupported platforms cannot execute unprotected scripts",
      ["win32", ["."], "unsupported"],
      true,
    ),
    rejected("paths outside the live project fail closed", ["linux", ["."], "outside"], true),
    rejected("excessive scope entries fail closed", ["linux", ["."], "capacity"], true),
    rejected("unsafe filesystem metadata fails closed", ["linux", ["."], "metadata"], true),
    rejected(
      "missing pinned sandbox fails closed and removes its policy",
      ["linux", ["missing.txt"], "missing"],
      true,
    ),
    rejected("excessive policy bytes fail closed", ["linux", [], "bytes"], true),
  ],
};

export const scriptScopeProcessCases = {
  positive: [
    positive(
      "production script creates a declared live file",
      ["test ! -e allowed.txt && printf Created > allowed.txt", ["allowed.txt"], false, false],
      true,
    ),
    positive(
      "production script retains its exact claim through server restart",
      ["test ! -e allowed.txt && printf Created > allowed.txt", ["allowed.txt"], false, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "production script preserves an outside sibling and retains the refusal",
      [
        "printf Escaped > ../outside.txt; printf Created > allowed.txt",
        ["allowed.txt"],
        true,
        false,
      ],
      true,
    ),
    rejected(
      "production root scope protects metadata and retains the refusal after restart",
      ["printf Escaped > .git/config; printf Created > allowed.txt", ["."], true, true],
      true,
    ),
  ],
};

export const scriptLifetimeCases = {
  positive: [
    positive(
      "a scoped command completes with its declared write",
      ["complete", "printf Changed > allowed.txt"],
      true,
    ),
    positive(
      "a scoped descendant completes with its declared write",
      ["complete", "/bin/sh -c 'printf Changed > allowed.txt'"],
      true,
    ),
  ],
  negative: [
    rejected(
      "timeout kills detached descendants holding writable descriptors",
      ["timeout", "exec 3>> allowed.txt; setsid /bin/sh -c 'sleep 0.5; printf Late >&3' & wait"],
      true,
    ),
    rejected(
      "cancellation kills detached descendants holding writable descriptors",
      ["cancel", "exec 3>> allowed.txt; setsid /bin/sh -c 'sleep 0.5; printf Late >&3' & wait"],
      true,
    ),
    rejected(
      "timeout prevents a descendant from writing after release",
      ["timeout", "(sleep 0.5; printf Late > allowed.txt)& wait"],
      true,
    ),
    rejected(
      "cancellation prevents a descendant from writing after release",
      ["cancel", "(sleep 0.5; printf Late > allowed.txt)& wait"],
      true,
    ),
  ],
};

export const scriptReadClaimCases = {
  positive: [
    positive(
      "read proof can inspect its claimed file",
      ["test $(cat allowed.txt) = Original", false],
      true,
    ),
    positive(
      "read proof can use its private scratch directory",
      ['printf Scratch > "$TMPDIR/output" && test $(cat "$TMPDIR/output") = Scratch', false],
      true,
    ),
  ],
  negative: [
    rejected(
      "read proof cannot update its claimed file",
      ["printf Changed > allowed.txt", true],
      true,
    ),
    rejected("read proof cannot create a project file", ["printf Changed > extra.txt", true], true),
  ],
};
