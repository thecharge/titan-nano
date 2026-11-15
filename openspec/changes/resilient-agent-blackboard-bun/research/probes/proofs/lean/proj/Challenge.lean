-- The locked statement. The main agent writes it and the person approves it.
def sumTo : Nat → Nat
  | 0 => 0
  | n + 1 => (n + 1) + sumTo n

theorem sumTo_formula (n : Nat) : 2 * sumTo n = n * (n + 1) := sorry

theorem sumTo_100 : 2 * sumTo 100 = 100 * 101 := sorry
