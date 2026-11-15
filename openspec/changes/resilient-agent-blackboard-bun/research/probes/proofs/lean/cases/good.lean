def sumTo : Nat → Nat
  | 0 => 0
  | n + 1 => (n + 1) + sumTo n

theorem sumTo_formula (n : Nat) : 2 * sumTo n = n * (n + 1) := by
  induction n with
  | zero => rfl
  | succ k ih =>
    simp only [sumTo]
    rw [Nat.mul_add, ih]
    simp only [Nat.add_mul, Nat.mul_add, Nat.mul_comm]
    omega

theorem sumTo_100 : 2 * sumTo 100 = 100 * 101 := by decide
