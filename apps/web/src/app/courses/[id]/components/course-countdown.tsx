'use client';

import { useCountdown } from '@/hooks/use-countdown';
import { useSettings } from '@/lib/settings-context';

interface CourseCountdownProps {
  short?: boolean;
}

export default function CourseCountdown({ short = false }: CourseCountdownProps) {
  const { settings } = useSettings();
  const { show, displayText, shortDisplayText } = useCountdown(settings?.discountValidUntil);

  // If there is no timer => render nothing
  if (!show) return null;

  return <>{short ? shortDisplayText : displayText}</>;
}
