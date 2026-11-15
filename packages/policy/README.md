# @titan/policy

## Responsibilities

Owns the policy for each kind of goal. This part holds the trails of its choices.

## Public contract

`fadeTrails` takes the trails of one kind, a count for each choice, and returns them multiplied by the fade of 0.98. Call it once for each new learning-eligible terminal run. It does not change its input. A count below 0 or a count that is not a number fails.

## Verification

Use the offline cases for trails. They check a trail of 10 that fades to 9.8, an untouched zero trail, an empty set and a refused negative count.

## Limits

The fade of 0.98 is a guess that has not been measured. This part does not yet decide when a run is eligible, nor add to the trail of the chosen choice.
