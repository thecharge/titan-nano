import { posix } from "node:path";
import { BoundaryRule, PackageArchitecture, PackageLayer, TitanPackage } from "@titan/constants";

function adapter(name: string): boolean {
  return PackageArchitecture.AdapterPrefixes.some((prefix) => name.startsWith(prefix));
}

function testing(name: string): boolean {
  return (
    name === PackageArchitecture.TestAggregation ||
    PackageArchitecture.TestPrefixes.some((prefix) => name.startsWith(prefix))
  );
}

export function vendorOwner(dependency: string): string | undefined {
  return Object.entries(PackageArchitecture.AdapterVendors).find(([, names]) =>
    names.some((name) => name === dependency),
  )?.[0];
}

export function dependencyDirection(
  owner: string,
  dependency: string,
  layer = PackageLayer.Product,
): BoundaryRule | undefined {
  const foundation = PackageArchitecture.Foundation.some((name) => name === dependency);
  if (owner === TitanPackage.Core && !foundation) return BoundaryRule.CoreDirection;
  if (adapter(owner)) {
    const vendors = Object.entries(PackageArchitecture.AdapterVendors).find(
      ([name]) => name === owner,
    )?.[1];
    if (
      dependency !== TitanPackage.Core &&
      !foundation &&
      !vendors?.some((name) => name === dependency)
    )
      return BoundaryRule.AdapterDirection;
  }
  const vendor = vendorOwner(dependency);
  if (vendor && vendor !== owner && layer !== PackageLayer.Test)
    return BoundaryRule.VendorIsolation;
  if (adapter(dependency) && owner !== PackageArchitecture.Runtime && layer !== PackageLayer.Test)
    return BoundaryRule.AdapterComposition;
  if (testing(dependency)) {
    const order: readonly string[] = PackageArchitecture.TestOrder;
    const ownerRank = order.indexOf(owner);
    const dependencyRank = order.indexOf(dependency);
    if (
      layer !== PackageLayer.Test ||
      ownerRank < 0 ||
      dependencyRank < 0 ||
      dependencyRank >= ownerRank
    )
      return BoundaryRule.TestDirection;
  }
  return undefined;
}

export function validPackageIdentity(directory: string, name: string): boolean {
  const named = Object.entries(PackageArchitecture.NamedWorkspaces).find(
    ([owner]) => owner === name,
  );
  if (named) return directory === named[1];
  return (
    name === PackageArchitecture.Scope + posix.basename(directory) &&
    posix.dirname(directory) === PackageArchitecture.ProductDirectory &&
    !testing(name)
  );
}
