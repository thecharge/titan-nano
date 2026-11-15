# @titan/embedder-local

## Responsibilities

Gives the default embedder for meaning search. It turns a text into a list of numbers with a model that runs on this computer, with `@huggingface/transformers`.

## Public contract

`createLocalEmbedder` gives an object with a `name` and one function, `embed`. It takes a text and returns a list of numbers with the set length. The model loads on the first call and stays loaded.

## Verification

Use the offline cases for the loading code. They run with a fake module and no model. The real model test is required. Run `bun run test:prepare` once to prepare the pinned dependency, then run the offline suite. Missing prepared artifacts fail the test.

## Limits

Runtime composes `createCachedEmbedder` with the workspace model cache. Its first call verifies local artifacts before loading the SDK with local files only and quantized weights. Install or explicit doctor setup downloads the model. Runtime never downloads it. Without the model, combined search falls back to word search and says so. The revision is part of the embedder identity, so changed models require explicit reindexing.
