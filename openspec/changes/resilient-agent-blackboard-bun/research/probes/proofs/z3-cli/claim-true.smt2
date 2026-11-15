; claim: for all integers x, y > 0, x + y > x. Assert the negation.
(declare-const x Int)
(declare-const y Int)
(assert (not (=> (and (> x 0) (> y 0)) (> (+ x y) x))))
(check-sat)
