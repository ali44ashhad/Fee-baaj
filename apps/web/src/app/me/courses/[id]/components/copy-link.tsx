'use client';

import Button from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';

export default function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const copyReferralLink = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast('Copied!', { position: 'bottom-center' });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button className="rounded-l-none w-auto block p-2" onClick={copyReferralLink}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}
