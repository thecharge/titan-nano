## 1. Establish replacement evidence

- [x] 1.1 Inspect the current package and record candidate source identities, actual containment failures and the owner's Apache-2.0 constraint.
- [x] 1.2 Apply the owner's Apache-2.0 replacement requirement and remove the unnecessary approval dependency from the implementation plan.
- [x] 1.3 Add and run regression cases for read-only opens carrying mutation flags, checking original outside contents and permissions.

## 2. Implement the replacement

- [x] 2.1 Implement a boundary that supports exact missing-file and missing-parent creation, protected names, temporary files and descendant containment on the shared live tree.
- [x] 2.2 Replace the helper build and execution paths using pinned sources and preserve approval, cancellation and update behavior.
- [x] 2.3 Remove the rejected helper artifacts from the delivered archive and update its component inventory and installation instructions.

## 3. Verify and deliver

- [x] 3.1 Add a blocking distribution check with fixtures that reject the removed helper and incomplete component inventories.
- [x] 3.2 Run the complete source boundary cases and installed-package script and read-claim cases with the replacement.
- [x] 3.3 Run the required local delivery checks, inspect the final archive and diff, and push through normal hooks after verifying GitHub Actions is disabled.
