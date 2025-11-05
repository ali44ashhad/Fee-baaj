import { GENDER } from '@elearning/types';
import React from 'react';
import type { UseFormRegister, FieldValues, FieldErrors } from 'react-hook-form';

interface RadioOption {
  value: string;
  label: string;
}

interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  options: RadioOption[];
  error?: string;
  changeHandler: (g: GENDER) => void;
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, type, error, label, id, options, changeHandler, value, ...props }, ref) => {
    return (
      <div className={`text-gray-900 ${className}`}>
        <label className="font-semibold text-gray-500">{label}</label>
        <div className="flex gap-2  ">
          {options.map((option) => (
            <label key={option.value} className={`flex gap-1  justify-center  w-full items-center px-[clamp(0.6rem,2vw,1rem)] py-[clamp(0.8rem,1vh,2rem)]   rounded-[19px] border text-center cursor-pointer ${
              error ? 'border-red-500' : 'border-blue-400'
            } ${option.value === value ? 'border-red-500 bg-red-50 text-red-500' : 'bg-white'}`}>
          
              <input
                type="radio"
                value={option.value}
                id={option.value}
            
                ref={ref}
                checked={option.value === value}
                onChange={() => changeHandler(option.value as any)}
                {...props}
              />
              <div
                
              >
                {option.label}
              </div>
            </label>
          ))}
        </div>
        {/* {error && <p className="text-red-500 text-sm mt-1">{error}</p>} */}
      </div>
    );
  },
);

export default Radio;
