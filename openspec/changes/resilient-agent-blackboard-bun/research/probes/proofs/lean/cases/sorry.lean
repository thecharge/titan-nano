def sumTo : Nat → Nat
  | 0 => 0
  | n + 1 => (n + 1) + sumTo n

theorem sumTo_formula (n : Nat) : 2 * sumTo n = n * (n + 1) := by
  sorry

theorem sumTo_100 : 2 * sumTo 100 = 100 * 101 := by decide
