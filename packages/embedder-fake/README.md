# @titan/embedder-fake

## Responsibilities

Gives a fixed embedder for offline use. It turns a text into a list of numbers without any outside call.

## Public contract

`createFakeEmbedder` gives an object with one function, `embed`. It takes a text and returns a list of numbers. The same text always gives the same list. Two different texts give different lists.

## Verification

Use the offline cases for the embedder. They check that the same text gives the same list, that the list has the set length and that two different texts give different lists.

## Limits

The list has no meaning. It does not measure how close two texts are in sense. Use it only in tests and offline runs.
