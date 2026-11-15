import { UsageLimit } from "@titan/constants";

export function limitDelay(text: string, now: Date): number | null {
  const match = UsageLimit.Pattern.exec(text);
  if (!match) return null;
  const [
    ,
    hour = UsageLimit.NoHour,
    minute = UsageLimit.NoMinute,
    meridiem = UsageLimit.NoMeridiem,
  ] = match;
  const afternoon = meridiem.toLowerCase() === UsageLimit.Afternoon ? UsageLimit.HalfDay : 0;
  const reset = new Date(now);
  reset.setHours((Number(hour) % UsageLimit.HalfDay) + afternoon, Number(minute), 0, 0);
  if (reset.getTime() <= now.getTime()) reset.setDate(reset.getDate() + 1);
  return reset.getTime() - now.getTime();
}

export function minutesLeft(until: number, now: number): number {
  return Math.max(1, Math.ceil((until - now) / UsageLimit.MillisecondsPerMinute));
}
