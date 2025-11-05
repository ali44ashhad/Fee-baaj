import React from 'react';

export default function RefundPolicyPage() {
  return (
    <div className="max-w-4xl px-4 py-12 mx-auto text-gray-900">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6">Cancellation & Refund Policy</h1>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">What is a refund?</h2>
        <p>
          When a learner is unable to access the course due to technical issues in the app/website,
          or doesn’t receive resources as promised, or mistakenly purchases a different course than
          intended, the user may request a refund. This will go through a verification process.
        </p>

        <h2 className="text-2xl font-semibold">How to request a refund?</h2>
        <p>
          Refunds are available within 30 days of payment. Email us at{' '}
          <a href="mailto:support@freebaj.net" className="text-blue-600 underline">support@freebaj.net</a>{' '}
          with the email or phone number used for purchase. You will receive a form to officially
          submit the refund request.
        </p>
        <ul className="list-disc pl-6">
          <li>Refund requests must be submitted via email within 30 days of purchase.</li>
          <li>Refunds are not applicable for e-books.</li>
          <li>If you’ve attended 3+ classes, refunds are not applicable.</li>
          <li>Refunds take 7-14 business days after approval.</li>
        </ul>

        <h2 className="text-2xl font-semibold">When will the refund not be applicable?</h2>
        <ul className="list-disc pl-6">
          <li>Requests after 30 days of purchase.</li>
          <li>If you continue classes after requesting a refund.</li>
          <li>If you access premium content after requesting a refund.</li>
          <li>If you've purchased an e-book or attended 3+ classes in a subscription.</li>
        </ul>

        <h2 className="text-2xl font-semibold">When will the refund be applicable?</h2>
        <ul className="list-disc pl-6">
          <li>Mistaken purchase with intent to switch to another course.</li>
          <li>Resources promised not delivered.</li>
          <li>Accidental purchase of live instead of recorded class, or vice versa.</li>
        </ul>

        <h2 className="text-2xl font-semibold">What happens after a refund request?</h2>
        <p>
          Your course will be locked and you will be notified within 3 business days. If approved,
          you’ll be unenrolled and lose progress. You can repurchase and restart the course.
        </p>
        <p>
          Refunds take 7-14 business days. If it takes longer, contact{' '}
          <a href="mailto:support@freebaj.net" className="text-blue-600 underline">support@freebaj.net</a>. Confirmation will be sent via email/SMS.
        </p>

        <p className="italic">
          Freebaj reserves the right to change the terms and conditions at any time.
        </p>
      </section>
    </div>
  );
}
