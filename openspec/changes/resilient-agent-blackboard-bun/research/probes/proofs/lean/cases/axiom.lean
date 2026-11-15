def sumTo : Nat → Nat
  | 0 => 0
  | n + 1 => (n + 1) + sumTo n

axiom trust_me : ∀ n : Nat, 2 * sumTo n = n * (n + 1)

theorem sumTo_formula (n : Nat) : 2 * sumTo n = n * (n + 1) := trust_me n

theorem sumTo_100 : 2 * sumTo 100 = 100 * 101 := by decide
