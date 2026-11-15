; claim: for all integers x, x * x > x. Assert the negation.
(declare-const x Int)
(assert (not (> (* x x) x)))
(check-sat)
(get-model)
