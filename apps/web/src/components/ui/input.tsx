import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, error, label, id, ...props }, ref) => {
  return (
    <div  className='flex flex-col gap-y-[clamp(6px,1vh,10px)]' >
      {label && (
        <label htmlFor={id} className="text-[5vw] sm:text-[clamp(0.5rem,3vh,29px)]  font-semibold text-gray-900">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4  rounded-full border ${
          error ? 'border-red-500' : 'border-blue-400'
        } focus:outline-none focus:border-red-blue ${className}`}
        id={id}
        type={type}
        ref={ref}
        {...props}
      />
      {/* {error && <p className="text-red-500 text-sm mt-1">{error}</p>} */}
    </div>
  );
});

export default Input;
