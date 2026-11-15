import { BoardLoad } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  boardAfterQuestionCases,
  parallelBoardWritesCases,
  unknownRequestKindCases,
} from "../cases/board-posts.ts";
import {
  boardAfterQuestion,
  parallelBoardWrites,
  unknownRequestKindRefusal,
} from "../factories/board-posts.ts";

unit(boardAfterQuestion, boardAfterQuestionCases);
unit(parallelBoardWrites, parallelBoardWritesCases, BoardLoad.TimeoutMs);
unit(unknownRequestKindRefusal, unknownRequestKindCases);
