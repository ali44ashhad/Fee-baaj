export const convertToBengaliDigits = (input: number | string | undefined): string => {
    if (input === null || input === undefined || input === '') {
      return 'মূল্য নেই'; // Bengali for "No price"
    }
  
    const engToBengaliMap: { [key: string]: string } = {
      '0': '০',
      '1': '১',
      '2': '২',
      '3': '৩',
      '4': '৪',
      '5': '৫',
      '6': '৬',
      '7': '৭',
      '8': '৮',
      '9': '৯',
      '.': '.', // optional if price might have decimals
      ',': ',', // optional if formatted with commas
    };
  
    return input
      .toString()
      .split('')
      .map((char) => engToBengaliMap[char] ?? '')
      .join('');
  };
  