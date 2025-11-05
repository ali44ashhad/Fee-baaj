import { ReactNode } from 'react';
import { Button } from '../ui/button';

interface PageLayoutProps {
  title: string;
  actions?: JSX.Element;
  children: ReactNode;
}

export default function PageLayout({ actions, children, title }: PageLayoutProps) {
  return (
    <>
      <div className="flex flex-row justify-between items-center mb-10">
        {title && <h2 className="text-xl font-semibold">{title}</h2>}
        <div>{actions}</div>
      </div>
      {children}
    </>
  );
}
