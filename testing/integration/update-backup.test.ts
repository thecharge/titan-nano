import { unit } from "@titan/test-factories";
import { updateBackupCases, updateBackupJournalCases } from "../cases/update-backup.ts";
import { updateBackup, updateBackupJournal } from "../factories/update-backup.ts";

unit(updateBackup, updateBackupCases);
unit(updateBackupJournal, updateBackupJournalCases);
