export const LessonMessage = {
  Comment: (runId: string, step: string): string => `# lesson from run ${runId}, step ${step}`,
} as const;
