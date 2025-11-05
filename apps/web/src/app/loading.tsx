// app/loading.tsx
'use client';

import { useEffect } from 'react';
import NProgress from 'nprogress';           
import 'nprogress/nprogress.css';            

export default function Loading() {
  useEffect(() => {
    NProgress.configure({ showSpinner: false });
    NProgress.start();                       
    return () => {
      NProgress.done();                    
    };
  }, []);

  // full‐screen white overlay only
  return <div className="fixed inset-0 bg-white z-50" />;
}
