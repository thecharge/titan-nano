import { dirname, join, normalize } from "node:path";
import { DataSchemaRule } from "@titan/constants";
import { dataSchemaReadLimit, invalidDataSource } from "@titan/messages";
import type { DataSchemaFinding } from "@titan/types";
import ts from "typescript";

async function children(node: ts.Node): Promise<ts.Node[]> {
  const result: ts.Node[] = [];
  ts.forEachChild(node, (child) => {
    result.push(child);
  });
  return result;
}

async function declarations(sources: ts.SourceFile[]) {
  const found = new Map<string, (ts.InterfaceDeclaration | ts.TypeAliasDeclaration)[]>();
  let count = 0;
  for (const node of sources.flatMap((source) => [...source.statements])) {
    if (!ts.isInterfaceDeclaration(node) && !ts.isTypeAliasDeclaration(node)) continue;
    const key = await declarationKey(node.getSourceFile().fileName, node.name.text);
    if (++count > DataSchemaRule.MaximumDeclarations) throw new Error(dataSchemaReadLimit);
    const group = found.get(key) ?? [];
    group.push(node);
    found.set(key, group);
    if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword))
      found.set(await declarationKey(node.getSourceFile().fileName, DataSchemaRule.Default), group);
  }
  return found;
}

async function declarationKey(file: string, name: string): Promise<string> {
  return normalize(file) + DataSchemaRule.KeySeparator + name;
}

async function importedName(clause: ts.ImportClause | undefined, name: string) {
  if (clause?.name?.text === name) return DataSchemaRule.Default;
  const bindings = clause?.namedBindings;
  if (!bindings) return undefined;
  if (ts.isNamedImports(bindings)) {
    const entry = bindings.elements.find((item) => item.name.text === name);
    return entry ? (entry.propertyName ?? entry.name).text : undefined;
  }
  const parts = name.split(DataSchemaRule.MemberSeparator);
  return parts[0] === bindings.name.text
    ? parts.slice(1).join(DataSchemaRule.MemberSeparator)
    : undefined;
}

async function knownDeclaration(
  name: string,
  source: ts.SourceFile,
  known: ReadonlyMap<string, (ts.InterfaceDeclaration | ts.TypeAliasDeclaration)[]>,
) {
  const local = known.get(await declarationKey(source.fileName, name));
  if (local) return local;
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier))
      continue;
    if (!statement.moduleSpecifier.text.startsWith(DataSchemaRule.MemberSeparator)) continue;
    const imported = await importedName(statement.importClause, name);
    if (!imported) continue;
    const path = join(dirname(source.fileName), statement.moduleSpecifier.text);
    const declaration = known.get(await declarationKey(path, imported));
    if (declaration) return declaration;
  }
  return undefined;
}

async function propertiesAreData(
  members: ts.NodeArray<ts.TypeElement>,
  known: ReadonlyMap<string, (ts.InterfaceDeclaration | ts.TypeAliasDeclaration)[]>,
  active: ReadonlySet<string>,
): Promise<boolean> {
  for (const member of members) {
    if (!ts.isPropertySignature(member) || !member.type) return false;
    if (!(await dataType(member.type, known, active))) return false;
  }
  return true;
}

async function bindsName(statement: ts.Statement, name: string): Promise<boolean> {
  if (ts.isImportDeclaration(statement))
    return Boolean(await importedName(statement.importClause, name));
  if (
    ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isImportEqualsDeclaration(statement)
  )
    return statement.name?.text === name;
  return false;
}

async function executableBuiltin(name: string, source: ts.SourceFile): Promise<boolean> {
  if (!DataSchemaRule.Executable.some((value) => value === name)) return false;
  for (const statement of source.statements) if (await bindsName(statement, name)) return false;
  return true;
}

async function referenceIsData(
  name: string,
  source: ts.SourceFile,
  known: ReadonlyMap<string, (ts.InterfaceDeclaration | ts.TypeAliasDeclaration)[]>,
  active: ReadonlySet<string>,
): Promise<boolean> {
  const declarations = await knownDeclaration(name, source, known);
  if (!declarations) return !(await executableBuiltin(name, source));
  const key = await declarationKey(source.fileName, name);
  if (active.has(key) || active.size >= DataSchemaRule.MaximumDepth) return true;
  const next = new Set([...active, key]);
  for (const declaration of declarations) {
    const data = ts.isInterfaceDeclaration(declaration)
      ? await declarationIsData(declaration, known, next)
      : await dataType(declaration.type, known, next);
    if (!data) return false;
  }
  return true;
}

async function allData(
  types: readonly ts.TypeNode[],
  known: ReadonlyMap<string, (ts.InterfaceDeclaration | ts.TypeAliasDeclaration)[]>,
  active: ReadonlySet<string>,
): Promise<boolean> {
  for (const type of types) if (!(await dataType(type, known, active))) return false;
  return true;
}

async function dataType(
  type: ts.TypeNode,
  known: ReadonlyMap<string, (ts.InterfaceDeclaration | ts.TypeAliasDeclaration)[]>,
  active: ReadonlySet<string>,
): Promise<boolean> {
  if (ts.isFunctionTypeNode(type) || ts.isConstructorTypeNode(type)) return false;
  if (ts.isParenthesizedTypeNode(type) || ts.isTypeOperatorNode(type))
    return dataType(type.type, known, active);
  if (ts.isArrayTypeNode(type)) return dataType(type.elementType, known, active);
  if (ts.isTupleTypeNode(type)) return allData(type.elements, known, active);
  if (ts.isNamedTupleMember(type) || ts.isOptionalTypeNode(type) || ts.isRestTypeNode(type))
    return dataType(type.type, known, active);
  if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type))
    return allData(type.types, known, active);
  if (ts.isTypeLiteralNode(type)) return propertiesAreData(type.members, known, active);
  if (!ts.isTypeReferenceNode(type)) return true;
  const name = type.typeName.getText();
  if (DataSchemaRule.Inferred.some((value) => value === name)) return true;
  return (
    (await referenceIsData(name, type.getSourceFile(), known, active)) &&
    (await allData(type.typeArguments ?? [], known, active))
  );
}

async function declarationIsData(
  node: ts.InterfaceDeclaration | ts.TypeLiteralNode,
  known: ReadonlyMap<string, (ts.InterfaceDeclaration | ts.TypeAliasDeclaration)[]>,
  active: ReadonlySet<string>,
): Promise<boolean> {
  if (!(await propertiesAreData(node.members, known, active))) return false;
  if (!ts.isInterfaceDeclaration(node)) return true;
  for (const type of (node.heritageClauses ?? []).flatMap((clause) => [...clause.types]))
    if (!(await referenceIsData(type.expression.getText(), type.getSourceFile(), known, active)))
      return false;
  return true;
}

async function shapeName(node: ts.Node): Promise<string> {
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return node.name.text;
  return node.parent && !ts.isSourceFile(node.parent)
    ? shapeName(node.parent)
    : DataSchemaRule.Anonymous;
}

async function inspectNode(
  node: ts.Node,
  source: ts.SourceFile,
  known: ReadonlyMap<string, (ts.InterfaceDeclaration | ts.TypeAliasDeclaration)[]>,
  findings: DataSchemaFinding[],
): Promise<void> {
  if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) {
    if (
      ts.isInterfaceDeclaration(node)
        ? await referenceIsData(node.name.text, source, known, new Set())
        : await declarationIsData(node, known, new Set())
    )
      findings.push({
        file: source.fileName,
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        name: await shapeName(node),
      });
  }
  for (const child of await children(node)) await inspectNode(child, source, known, findings);
}

export async function inspectDataSchemas(
  files: Record<string, string>,
): Promise<DataSchemaFinding[]> {
  const sources: ts.SourceFile[] = [];
  for (const [file, text] of Object.entries(files)) {
    const fileName = file.replace(
      DataSchemaRule.DeclarationPattern,
      DataSchemaRule.DeclarationReplacement,
    );
    const result = ts.transpileModule(text, { fileName, reportDiagnostics: true });
    if (
      result.diagnostics?.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    )
      throw new Error(invalidDataSource(file));
    sources.push(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  }
  const known = await declarations(sources);
  const findings: DataSchemaFinding[] = [];
  for (const source of sources) await inspectNode(source, source, known, findings);
  return findings;
}
