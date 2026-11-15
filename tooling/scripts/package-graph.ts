import { posix } from "node:path";
import { BoundaryRule, Development, HookFile, HookToolchain, PathPart } from "@titan/constants";
import { VerificationMessage } from "@titan/messages";
import type { BoundaryFinding, WorkspaceSource } from "@titan/types";
import ts from "typescript";
import { dependencyDirection, validPackageIdentity, vendorOwner } from "./package-direction.ts";

function imports(source: string): string[] {
  const result: string[] = [];
  const tree = ts.createSourceFile(Development.SourceFile, source, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      result.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === Development.Require))
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) result.push(argument.text);
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      result.push(node.argument.literal.text);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return result;
}
const packageName = (specifier: string): string =>
  specifier.startsWith(Development.Scope)
    ? specifier.split(PathPart.Separator).slice(0, 2).join(PathPart.Separator)
    : (specifier.split(PathPart.Separator)[0] ?? specifier);
export function inspectPackageGraph(workspaces: readonly WorkspaceSource[]): BoundaryFinding[] {
  const findings: BoundaryFinding[] = [];
  const packages = new Map(workspaces.map((workspace) => [workspace.manifest.name, workspace]));
  const edges = new Map<string, Set<string>>();
  const report = (workspace: WorkspaceSource, file: string, rule: string, detail: string): void => {
    findings.push({ package: workspace.manifest.name, file, rule, detail });
  };
  if (packages.size !== workspaces.length)
    findings.push({
      package: Development.Workspace,
      file: HookFile.Manifest,
      rule: BoundaryRule.DuplicatePackage,
      detail: VerificationMessage.DuplicatePackage,
    });
  const inspectDependencies = (workspace: WorkspaceSource): void => {
    const { manifest } = workspace;
    const dependencies = manifest.dependencies ?? {};
    for (const [name, version] of Object.entries(dependencies)) {
      if (version.startsWith(HookToolchain.Workspace) && !packages.has(name))
        report(workspace, HookFile.Manifest, BoundaryRule.MissingWorkspace, name);
      const direction = dependencyDirection(manifest.name, name);
      if (direction) report(workspace, HookFile.Manifest, direction, name);
    }
  };
  const inspectImport = (
    workspace: WorkspaceSource,
    file: string,
    specifier: string,
    graph: Set<string>,
  ): void => {
    const { manifest } = workspace;
    const dependencies = manifest.dependencies ?? {};
    if (specifier.startsWith(Development.NodePrefix) || specifier.startsWith(Development.BunPrefix))
      return;
    if (specifier.startsWith(PathPart.Current)) {
      const target = posix.normalize(
        posix.join(workspace.directory, posix.dirname(file), specifier),
      );
      if (!target.startsWith(`${workspace.directory}${PathPart.Separator}`))
        report(workspace, file, BoundaryRule.CrossPackagePath, specifier);
      return;
    }
    const name = packageName(specifier);
    const vendor = vendorOwner(name);
    if (vendor && vendor !== manifest.name)
      report(workspace, file, BoundaryRule.VendorIsolation, specifier);
    if (!Object.hasOwn(dependencies, name))
      report(workspace, file, BoundaryRule.UndeclaredImport, specifier);
    const target = packages.get(name);
    if (!target) return;
    graph.add(name);
    const subpath =
      specifier === name ? PathPart.Current : `${PathPart.Current}${specifier.slice(name.length)}`;
    if (!Object.hasOwn(target.manifest.exports ?? {}, subpath))
      report(workspace, file, BoundaryRule.PrivateExport, specifier);
  };
  const inspectSource = (
    workspace: WorkspaceSource,
    file: string,
    source: string,
    graph: Set<string>,
  ): void => {
    for (const specifier of imports(source)) inspectImport(workspace, file, specifier, graph);
  };
  for (const workspace of workspaces) {
    const { manifest } = workspace;
    if (!validPackageIdentity(workspace.directory, manifest.name))
      report(workspace, HookFile.Manifest, BoundaryRule.PackageIdentity, manifest.name);
    const dependencies = manifest.dependencies ?? {};
    const graph = new Set(Object.keys(dependencies).filter((name) => packages.has(name)));
    edges.set(manifest.name, graph);
    inspectDependencies(workspace);
    const entries = Object.values(manifest.exports ?? manifest.bin ?? {});
    if (entries.length === 0)
      report(
        workspace,
        HookFile.Manifest,
        BoundaryRule.PublicContract,
        VerificationMessage.PublicContract,
      );
    for (const entry of entries.filter(
      (entry) => !Object.hasOwn(workspace.sources, posix.normalize(entry)),
    ))
      report(workspace, HookFile.Manifest, BoundaryRule.MissingExport, entry);
    for (const [file, source] of Object.entries(workspace.sources)) {
      inspectSource(workspace, file, source, graph);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (name: string, path: string[]): void => {
    if (visiting.has(name)) {
      findings.push({
        package: name,
        file: HookFile.Manifest,
        rule: BoundaryRule.DependencyCycle,
        detail: [...path, name].join(Development.DependencyCycleSeparator),
      });
      return;
    }
    if (visited.has(name)) return;
    visiting.add(name);
    for (const dependency of edges.get(name) ?? []) visit(dependency, [...path, name]);
    visiting.delete(name);
    visited.add(name);
  };
  for (const name of packages.keys()) visit(name, []);
  return findings;
}
