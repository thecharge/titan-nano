; claim: no positive integers with x^3 + y^3 = z^3 (Fermat, n = 3). Assert the negation.
(declare-const x Int)
(declare-const y Int)
(declare-const z Int)
(assert (and (> x 0) (> y 0) (> z 0)))
(assert (= (+ (* x x x) (* y y y)) (* z z z)))
(check-sat)
