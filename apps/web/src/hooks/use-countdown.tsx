import { formatNumber } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function useCountdown(targetDate?: string | Date, short: boolean = false) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [show, setShow] = useState(false);
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    if (!targetDate) {
      setShow(false);
      return;
    }

    const deadline = new Date(targetDate).getTime();

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const distance = deadline - now;

      if (distance <= 0) {
        setShow(false);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      setShow(true);
      return {
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      }; 
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer); 
  }, [targetDate]);

  useEffect(() => {
    const dt = `${timeLeft.days > 0 && `${timeLeft.days}days`} ${formatNumber(timeLeft.hours)}hours ${formatNumber(timeLeft.minutes)}minutes ${formatNumber(timeLeft.seconds)}seconds`;
    setDisplayText(dt);
  }, [timeLeft]);

  return {
    timeLeft,
    show,
    displayText,
    shortDisplayText: displayText
      .replace('days', 'd')
      .replace('hours', 'h')
      .replace('minutes', 'm')
      .replace('seconds', 's'),
  };
}
